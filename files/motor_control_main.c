#include <stdio.h>
#include "pico/stdlib.h"
#include "ina219.h"
#include "hardware/pwm.h"
#include "encoder.h"

//Pin Intilization
#define IN1_PIN 16
#define IN2_PIN 17
#define BUF_SIZE 200

#define MAX_PWM 6250
#define MAX_DUTY 100.0

// User input duty cycle stored here
volatile float duty_cycle = 0.0;

//Step 15, adding ki and kp variables
volatile float Kp_current = 0.0;
volatile float Ki_current = 0.0;

//Part 2 - Step 6
volatile float current_desired = 0.0;
volatile float current_error = 0.0;
volatile float current_integral = 0.0;

#define ITEST_LENGTH 400 //Global var 4 ms
volatile float itest_desired[ITEST_LENGTH];
volatile float itest_actual[ITEST_LENGTH];
volatile int itest_index = 0;


//Part 2 - step 9
#define CPR 1336 // (CPR) Counts per revolution -> 334 PPR * 4x quadrature = 1336 CPR

//Part2 - step 10
volatile float Kp_position = 0.0;
volatile float Kd_position = 0.0;
volatile float Ki_position = 0.0;

//Part 2 - Step 13 --> Prepare variables for trajectory tracking(Global index, global array)
// Position control variables
#define TRAJECTORY_LENGTH 4000  // 200Hz * 20 seconds max

volatile float desired_angles[TRAJECTORY_LENGTH];
volatile float actual_angles[TRAJECTORY_LENGTH];
volatile int trajectory_size = 0;      // how many angles are in the trajectory
volatile int trajectory_index = 0;     // current position in trajectory

// Output of position PID → becomes desired current for current_control
volatile float current_desired_position = 0.0;

typedef enum {
    IDLE,
    PWM,
    ITEST,
    HOLD,
    TRACK
} mode_t;

// State var to be used to know what is happening to motor at any time t
volatile mode_t mode = IDLE;


// Declare that there will be a func later, otherwise setDir throughs implicit declartion error
void setDir(float duty);

//Part 2 - Step 12 -( Im so tired :( )
struct repeating_timer position_timer;
void position_control_func(struct repeating_timer *t);

//Step 8 --> Timer based interupt(1kHz)
struct repeating_timer timer;
bool current_control(struct repeating_timer *t){
    switch (mode){
        case IDLE: {
            setDir(0.0);
            break;
        }
        case PWM: {
            setDir(duty_cycle);
            break;
        }
        case ITEST: {
            if(itest_index <100){
                current_desired = -100.0;
            }
            else if(itest_index >= 200 && itest_index < 300){
                current_desired = -100.0;
            }
            else{
                current_desired = 100.0;
            }
            
            float current_actual = read_ina219();
            current_error = current_desired - current_actual;
            // add error over time(integral part of PID equation)
            current_integral += current_error;
            
            //PID Feeback control eq - from Quiz 3/5
            float output = Kp_current *current_error + Ki_current*current_integral;

            //Clamp
            if (output > 100.0){
                output = 100.0;
            }
            if(output < -100.0){
                output = -100.0;
            }

            setDir(output);

            itest_desired[itest_index] = current_desired;
            itest_actual[itest_index] = current_actual;
            itest_index++;

            //Clean up after ITEST - Set everything to zero and idle motor
            if(itest_index >= ITEST_LENGTH){
                itest_index = 0;
                current_integral = 0.0;
                setDir(0.0);
                mode = IDLE;
            }
            break;
        }
        case HOLD: {
            break;
        }
        case TRACK: {
            float current_actual = read_ina219();
            float error = current_desired_position - current_actual;
            current_integral += error;

            float output = Kp_current * error + Ki_current * current_integral;

            if (output > 100.0) output = 100.0;
            if (output < -100.0) output = -100.0;

            setDir(output);
            break;
        }
    }
    return true;
}

//H bridge intilization
void init_hbridge(){
    //IN1 - PWM
    gpio_set_function(IN1_PIN, GPIO_FUNC_PWM);
    uint slice1 = pwm_gpio_to_slice_num(IN1_PIN);
    uint chan1 = pwm_gpio_to_channel(IN1_PIN);

    //IN2 - PWM
    gpio_set_function(IN2_PIN, GPIO_FUNC_PWM);
    uint slice2 = pwm_gpio_to_slice_num(IN2_PIN);
    uint chan2 = pwm_gpio_to_channel(IN2_PIN);

    //New instructions both duty cycles set to 100
    pwm_set_wrap(slice1, MAX_PWM);
    pwm_set_wrap(slice2, MAX_PWM);

    pwm_set_chan_level(slice1, chan1, MAX_PWM);
    pwm_set_chan_level(slice2, chan2, MAX_PWM);

    pwm_set_enabled(slice1, true);
    pwm_set_enabled(slice2, true);
}

//Direction setter function - idk im not great with names
void setDir(float duty){
    uint slice1 = pwm_gpio_to_slice_num(IN1_PIN);
    uint chan1 = pwm_gpio_to_channel(IN1_PIN);
    uint slice2 = pwm_gpio_to_slice_num(IN2_PIN);
    uint chan2 = pwm_gpio_to_channel(IN2_PIN);

    if (duty > 0){
        //Forward motion
        pwm_set_chan_level(slice1, chan1, MAX_PWM); // If 100 determines direction
        float scale = duty / 100.0;
        int pwm_value = (int)(MAX_PWM * (1.0 - scale));
        pwm_set_chan_level(slice2, chan2, pwm_value);// Varies --> determines speed
    }
    else if (duty < 0){
        //Reverse motion
        float scale = duty / 100.0;
        int pwm_value = (int)(MAX_PWM * (1.0 - scale));
        pwm_set_chan_level(slice1, chan1, pwm_value); // Varies --> determines speed
        pwm_set_chan_level(slice2, chan2, MAX_PWM);// If 100 determines direction
    }
    else{
        //Brake - "Pull the lever Kronk!" - Emperor's new groove anyone
        pwm_set_chan_level(slice1, chan1, MAX_PWM);
        pwm_set_chan_level(slice2, chan2, MAX_PWM);
    }
}

//Part 2 step 12 position control function
bool position_control(struct repeating_timer *t){
    switch(mode){
        case TRACK:{
            // Read actual angle
            actual_angles[trajectory_index] = (getEncoder() / (float)CPR) * 360.0;
            
            // PID control
            float pos_error = desired_angles[trajectory_index] - actual_angles[trajectory_index];

            float pos_derivative;
            if (trajectory_index == 0){
                pos_derivative = 0.0;
            }
            else{
                float current_angle = actual_angles[trajectory_index];
                float previous_angle = actual_angles[trajectory_index - 1];
                pos_derivative = current_angle - previous_angle;
            }

            // Accumulate integral
            static float pos_integral = 0.0;
            pos_integral += pos_error;

            // Compute desired current from PID
            current_desired_position = Kp_position * pos_error 
                                     - Kd_position * pos_derivative 
                                     + Ki_position * pos_integral;

            // Clamp
            if (current_desired_position > 100.0) current_desired_position = 100.0;
            if (current_desired_position < -100.0) current_desired_position = -100.0;

            trajectory_index++;

            // Done tracking
            if (trajectory_index >= trajectory_size){
                trajectory_index = 0;
                pos_integral = 0.0;
                mode = IDLE;
            }
            break;
        }
        default:{
            break;
        }
    }
    return true;
}


int main()
{
    stdio_init_all();
    init_ina219();
    init_hbridge();
    initEncoder();
    add_repeating_timer_ms(-1, current_control, NULL, &timer); // -1 = 1/1ms(Should be 1kHz)
    add_repeating_timer_ms(-5, position_control, NULL, &position_timer); //Timer based interrupt 200Hz for step 12

    char buffer[BUF_SIZE]; // buffer of data rx from the client

    while (true) {
        scanf("%s", buffer); // wait for the client to send a command
        switch(buffer[0]){
            case 'd':
            {
                int n = 0;
                scanf("%d", &n);
                printf("%d\r\n", n+1);
                break;
            }
            case 'a':
            {
                float milliamps = read_ina219();
                printf("%.2f\r\n", milliamps);
                break;
            }
            case 'r': // Get state
            {
                printf("%d\r\n", mode);
                break;
            }
            case 'f': // Set duty cycle
            {
                scanf("%f", &duty_cycle);
                mode = PWM;
                printf("Duty cycle set to %.2f\r\n", duty_cycle);
                break;
            }
            case 'g': // Set Kp and Ki vals
            {
                scanf("%f %f", &Kp_current, &Ki_current);
                printf("Kp = %.2f, Ki = %.2f\r\n", Kp_current, Ki_current);
                break;
            }
            case 'h': // get Kp and Ki values
            {
                printf("%.2f %.2f\r\n", Kp_current, Ki_current);
                break;
            }
            case 'k':
            {
                itest_index = 0;
                current_integral = 0.0;
                mode = ITEST;

                while(mode ==ITEST){
                    tight_loop_contents();
                }

                printf("%d\r\n", ITEST_LENGTH);

                for (int i =0; i <ITEST_LENGTH; i++){
                    printf("%.2f %.2f\r\n", itest_desired[i], itest_actual[i]);
                }
                break;
            }
            case 'p':
            {
                mode = IDLE;
                printf("Motor unpowered\r\n");
                break;
            }
            case 't':
            {
                int counts = getEncoder();
                printf("%d\r\n", counts);
                break;
            }
            case 'y':
            {
                float angle = (getEncoder() / (float)CPR)*360;
                printf("%.2f\r\n", angle);
                break;
            }
            case 'z':
            {
                setEncoderToZero();
                break;
            }
            case 'i':
            {
                scanf("%f %f %f", &Kp_position, &Kd_position, &Ki_position);
                printf("Kp = %.2f, Kd = %.2f, Ki = %.2f\r\n", Kp_position, Kd_position, Ki_position);
                break;
            }
            case 'j':
            {
                printf("%.2f %.2f %.2f\r\n", Kp_position, Kd_position, Ki_position);
                break;
            }
            case 'n':
            {
                scanf("%d", &trajectory_size);
                for (int i = 0; i < trajectory_size; i++){
                    scanf("%f", &desired_angles[i]);
                }
                break;
            }
            case 'm':
            {
                scanf("%d", &trajectory_size);
                for (int i = 0; i < trajectory_size; i++){
                    scanf("%f", &desired_angles[i]);
                }
                break;
            }
            case 'o':
            {
                trajectory_index = 0;
                current_integral = 0.0;
                mode = TRACK;

                // Wait for tracking to finish
                while (mode == TRACK){
                    tight_loop_contents();
                }

                // Send data back to python
                printf("%d\r\n", trajectory_size);
                for (int i = 0; i < trajectory_size; i++){
                    printf("%.2f %.2f\r\n", desired_angles[i], actual_angles[i]);
                }
                break;
            }
            case 'q':
            {
                // q for quit. Later you may want to return to IDLE mode here
                break;
            }
            default:
            {
                // uh oh
            }
        }
    }
}
