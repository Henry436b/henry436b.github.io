# Motor Control Client in python

import matplotlib.pyplot as plt 
from statistics import mean 
def read_plot_matrix():
    n_str = ser.read_until(b'\n');  # get the number of data points to receive
    n_int = int(n_str.strip()) # turn it into an int
    print('Data length = ' + str(n_int))
    ref = []
    data = []
    data_received = 0
    while data_received < n_int:
        dat_str = ser.read_until(b'\n');  # get the data as a string, ints seperated by spaces
        dat_f = list(map(float,dat_str.split())) # now the data is a list
        ref.append(dat_f[0])
        data.append(dat_f[1])
        data_received = data_received + 1
    meanzip = zip(ref,data)
    meanlist = []
    for i,j in meanzip:
        meanlist.append(abs(i-j))
    score = mean(meanlist)
    t = range(len(ref)) # index array
    plt.plot(t,ref,'r*-',t,data,'b*-')
    plt.title('Score = ' + str(score))
    plt.ylabel('value')
    plt.xlabel('index')
    plt.show()

from genref import genRef

import serial
ser = serial.Serial('COM11')
print('Opening port: ')
print(ser.name)

has_quit = False
# menu loop
while not has_quit:
    print('Pico2 MOTOR DRIVER INTERFACE')
    # display the menu options; this list will grow
    print('\r\n\td: test case \r\n\ta: read current from INA219 \r\n\tr: get state \r\n\tf: set Duty cycle \r\n\tg: set Kp Ki \r\n\th: get Kp Ki \r\n\tk: ITEST \r\n\tp: Unpower motor  \r\n\tt: Encoder Counts \r\n\ty: read angle \r\n\tz: set angle to zero \r\n\ti: set position gains \r\n\tj: get position gains \r\n\tm: load step trajectory \r\n\tn: load cubic trajectory \r\n\to: track and plot trajectory \r\n\tq: Quit') # '\t' is a tab
  
    # read the user's choice
    selection = input('\nENTER COMMAND: ')
    selection_endline = selection+'\n'
     
    # send the command to the PIC32
    ser.write(selection_endline.encode()); # .encode() turns the string into a char array
    
    # take the appropriate action
    # Good ol python doesn't really have switches so just make the massive if/elif/else trees
    if (selection == 'd'):
        input_str = input('Enter an integer: ') 
        input_int = int(input_str)
        print('The number = ' + str(input_int)) 
        ser.write((str(input_int)+'\n').encode())
        n_str = ser.read_until(b'\n'); 
        n_int = int(n_str)
        print('Returned number = '+str(n_int)+'\n')

    elif (selection == 'a'):
        result_str = ser.read_until(b'\n')
        result_f = float(result_str.strip())
        print('Current = ' + str(result_f) + 'mA\n')

    elif (selection == 'r'):
        result_str = ser.read_until(b'\n')
        result_int = int(result_str.strip())
        print('State = ' + str(result_int) + '(0: IDLE, 1: PWM, 2:ITEST, 3: HOLD, 4: TRACK)\n')
    
    elif (selection == 'f'):
        input_str = input('Please give a duty cycle(-100.0 to 100.0): ')
        ser.write((input_str + '\n').encode())
        result_str = ser.read_until(b'\n')
        print(result_str.decode().strip() + '\n')
    
    elif (selection == 'g'):
        input_str = input('Enter Kp and Ki with a space in between: ')
        ser.write((input_str + '\n').encode())
        result_str = ser.read_until(b'\n')
        print(result_str.decode().strip() + '\n')

    elif (selection == 'h'):
        result_str = ser.read_until(b'\n')
        result = list(map(float, result_str.split()))
        print('Kp = ' + str(result[0]) + 'Ki = ' + str(result[1]) + '\n') 
    
    elif (selection == 'k'):
        read_plot_matrix()        

    elif (selection == 'p'):
        result_str = ser.read_until(b'\n')
        print(result_str.decode().strip() + '\n')

    elif(selection == 't'): # Just about here I realized the elif cases weren't gonna be in alphabetical order and nearly cried but its about 3 hours to late to fix it
        result_str = ser.read_until(b'\n')
        tempHold = int(result_str.strip())
        print('Encoder counts = ' + str(tempHold) + '\n')

    elif(selection == 'y'):
        result_str = ser.read_until(b'\n')
        result_f = float(result_str.strip())
        print('Angle = ' + str(result_f) + ' degrees\n')
    
    elif (selection == 'z'):
        print('Encoder set to zero\n')

    elif (selection == 'i'):
        input_str = input('Enter Kp, Kd, and Ki with spaces in between: ')
        ser.write((input_str + '\n').encode())
        result_str = ser.read_until(b'\n')
        print(result_str.decode().strip() + '\n')

    elif (selection == 'j'):
        result_str = ser.read_until(b'\n')
        result = list(map(float, result_str.split()))
        print('Kp = ' + str(result[0]) + ', Kd = ' + str(result[1]) + ', Ki = ' + str(result[2]) + '\n')

    elif (selection == 'q'):
        print('Exiting client')
        has_quit = True; # exit client
        # be sure to close the port
        ser.close()
    elif (selection == 'm'):
        ref = genRef('step')
        if ref != [-1]: 
            ser.write((str(len(ref)) + '\n').encode())
            for angle in ref:
                ser.write((str(angle) + '\n').encode())  # send each angle
            print('Step trajectory loaded, ' + str(len(ref)) + ' points\n')

    elif (selection == 'n'):
        ref = genRef('cubic')
        if ref != [-1]: 
            ser.write((str(len(ref)) + '\n').encode())
            for angle in ref:
                ser.write((str(angle) + '\n').encode())
            print('Cubic trajectory loaded, ' + str(len(ref)) + ' points\n')
   
    elif (selection == 'o'):
        read_plot_matrix()

    else:
        print('Invalid Selection ' + selection_endline)
