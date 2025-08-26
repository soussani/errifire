import React, {useState} from 'react';
import type {Node} from 'react';
import {BleManager} from 'react-native-ble-plx';
import {
  Button,
  Image,
  ImageBackground,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  ScrollView,
} from 'react-native';

import {request, PERMISSIONS} from 'react-native-permissions';
import ModalContainer from 'react-native-modal';

async function requestAllPermissions() {
  const perms = [];

  // Location (for Android < 12 BLE scans)
  perms.push(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);

  if (Platform.Version >= 31) {
    perms.push(PERMISSIONS.ANDROID.BLUETOOTH_SCAN);
    perms.push(PERMISSIONS.ANDROID.BLUETOOTH_CONNECT);
    perms.push(PERMISSIONS.ANDROID.BLUETOOTH_ADVERTISE);
  }

  const statuses = await requestMultiple(perms);

  // You can inspect statuses[...] === RESULTS.GRANTED
  const allGranted = perms.every(p => statuses[p] === RESULTS.GRANTED);
  if (!allGranted) {
    Alert.alert(
      'Permissions required',
      'This app needs Bluetooth and location permissions to work properly.',
      [{ text: 'OK' }],
    );
  }
}


export const manager = new BleManager();
const App: () => Node = () => {
  const MonitorSet = new Set([]);
  const [On, setOn] = useState(false);
  const [Level, setLevel] = useState(0);
  const [Boo, setBoo] = useState(false);
  const [High, setHigh] = useState(true);
  const [Device, setDevice] = useState(null);
  const [DeviceId, setDeviceId] = useState(null);
  const [NotConnectedDialog, setNotConnectedDialog] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [OverfillDialog, setOverfillDialog] = useState(null);
  const [PreviousState, setPreviousState] = useState(null);
  const [connectedDevices, setConnectedDevices] = React.useState([]);
  const [devices, setDevices] = React.useState([]);
  const [showDialog, setShowDialog] = useState(false);

  React.useEffect(() => {
    requestAllPermissions();
  }, []);

  const handleConnect = async (device) => {
    disconnectDevice();
    try {
      // Connect to the device
      const connectedDevice = await manager.connectToDevice(device.id);
      const connectedDevices = await manager.connectedDevices([]);
      console.log(connectedDevices);
      setConnectedDevices(connectedDevices);
  
      if (connectedDevice) {
        // Discover all services and characteristics
        await connectedDevice.discoverAllServicesAndCharacteristics();
  
        // Get the writable characteristic (with or without response)
        const characteristic = await getServicesAndCharacteristics(connectedDevice);
  
        // Write the initial value ('MA==' encoded string)
        await connectedDevice.writeCharacteristicWithResponseForService(
          characteristic.serviceUUID,
          characteristic.uuid,
          'MA=='
        );
  
        // Monitor the characteristic for changes
        connectedDevice.monitorCharacteristicForService(
          characteristic.serviceUUID,
          characteristic.uuid,
          (error, characteristic) => {
            if (error) {
              console.warn('Monitor error:', error);
            } else {
              // Process the characteristic value (your logic for monitoring goes here)
              console.log('Characteristic value:', characteristic.value);
              MonitorSet.add(characteristic.value.split('///')[0]);
  
              if (MonitorSet.has('cDEucGljPTP')) {
                setOn(true);
                MonitorSet.clear();
              } else if (MonitorSet.has('cDEucGljPTT')) {
                setOn(false);
                MonitorSet.clear();
              } else if (MonitorSet.has('cDIucGljPTb')) {
                setHigh(true);
                MonitorSet.clear();
              } else if (MonitorSet.has('cDIucGljPTX')) {
                setHigh(false);
                MonitorSet.clear();
              } else if (MonitorSet.has('cDAucGljPTf')) {
                setLevel(0);
                MonitorSet.clear();
              } else if (MonitorSet.has('cDAucGljPTj')) {
                setLevel(25);
                MonitorSet.clear();
              } else if (MonitorSet.has('cDAucGljPTn')) {
                setLevel(50);
                MonitorSet.clear();
              } else if (MonitorSet.has('cDAucGljPTEw')) {
                setLevel(75);
                MonitorSet.clear();
              } else if (MonitorSet.has('cDAucGljPTEx')) {
                setLevel(100);
                MonitorSet.clear();
              } else if (MonitorSet.has('cGFnZSBwYWdlMv')) {
                setOverfillDialog(true);
                setBoo(true);
                MonitorSet.clear();
              }
            }
          }
        );
  
        // Set device details and UI states
        setDeviceId(connectedDevice.id);
        setIsConnected(true);
        setDevice(connectedDevice);
        setNotConnectedDialog(false);
        setShowDialog(false);
      }
    } catch (error) {
      console.error('BLE connect/write error:', error);
      Alert.alert('BLE Error', error.message);
    }
  };
  
  const handleScan = async () => {
    await manager.startDeviceScan(
              null,
              null,
              (error, device) => {
                  if (error) {
                    noConnectionAlert();
                    setShowDialog(false)
                    console.error(error);
                  }
                  if (device) {
                      if (device.name) {
                          if ((device.name[0] === 'E' && device.name[1] === 'R' && device.name[2] === 'R' && device.name[3] === 'I') || (device.name[0] === 'E' && device.name[1] === 'r' && device.name[2] === 'r' && device.name[3] === 'i')) {
                              setDevices(prevDevices => [...prevDevices.filter(dev => dev.id !== device.id), device]);
                              console.log(devices);
                          }
                      }
                  }
              }
          );
      };



  React.useEffect(() => {
      setShowDialog(false)
  }, [!NotConnectedDialog])

  const getServicesAndCharacteristics = (device) => {
    return new Promise((resolve, reject) => {
      device.services().then(async (services) => {
        const characteristics = [];
  
        for (let service of services) {
          const chs = await service.characteristics();
          characteristics.push(...chs);
          // Log every characteristic on this service
          chs.forEach(c =>
            console.log(
              `Service ${service.uuid} → Char ${c.uuid}:`,
              {
                withResponse: c.isWritableWithResponse,
                withoutResponse: c.isWritableWithoutResponse,
                notify: c.isNotifiable,
                read: c.isReadable,
              }
            )
          );
        }
  
        // Find the first writable characteristic
        const writableCharacteristic = characteristics.find(
          (char) => char.isWritableWithResponse || char.isWritableWithoutResponse
        );
  
        if (!writableCharacteristic) {
          reject(new Error('No writable characteristic found'));
        } else {
          resolve(writableCharacteristic);
        }
      }).catch((error) => {
        console.error('Error fetching characteristics:', error);
        reject(error);
      });
    });
  };
  


  // const getServicesAndCharacteristics = device => {
  //   return new Promise((resolve, reject) => {
  //     device.services().then(services => {
  //       const characteristics = [];

  //       services.forEach((service, i) => {
  //         service.characteristics().then(c => {
  //           characteristics.push(c);

  //           if (i === services.length - 1) {
  //             const temp = characteristics.reduce((acc, current) => {
  //               return [...acc, ...current];
  //             }, []);
  //             const dialog = temp.find(
  //               characteristic => characteristic.isWritableWithoutResponse,
  //             );
  //             if (!dialog) {
  //               reject('NOT Writable characteristic');
  //             }
  //             resolve(dialog);
  //           }
  //         });
  //       });
  //     });
  //   });
  // };

  const sendValue1 = () => {
    if (!isConnected) {
      console.log('not connected');
      return;
    }
    Device.discoverAllServicesAndCharacteristics().then(device => {
      getServicesAndCharacteristics(device)
        .then(characteristic => {
          Device.writeCharacteristicWithResponseForService(
            characteristic.serviceUUID,
            characteristic.uuid,
            'EA==',
          );
        })
        .catch(error => {
          console.log(error);
        });
    });
  };

  const sendValue2 = () => {
    if (!isConnected) {
      console.log('not connected');
      return;
    }
    Device.discoverAllServicesAndCharacteristics().then(device => {
      getServicesAndCharacteristics(device)
        .then(characteristic => {
          Device.writeCharacteristicWithResponseForService(
            characteristic.serviceUUID,
            characteristic.uuid,
            'IA==',
          );
        })
        .catch(error => {
          console.log(error);
        });
    });
  };

  const getData = () => {
    if (!isConnected) {
      console.log('not connected');
      return;
    }
    Device.discoverAllServicesAndCharacteristics().then(device => {
      getServicesAndCharacteristics(device).then(characteristic => {
        const subscription = Device.monitorCharacteristicForService(
          characteristic.serviceUUID,
          characteristic.uuid,
          (error, characteristic) => {
            if (characteristic) {
              MonitorSet.add(characteristic.value.split('///')[0]);
              MonitorSet.add(characteristic.value.split('///')[1]);

              if (MonitorSet.has('cDEucGljPTP')) {
                setOn(true);
                MonitorSet.clear();
              } else if (MonitorSet.has('cDEucGljPTT')) {
                setOn(false);
                MonitorSet.clear();
              } else if (MonitorSet.has('cDIucGljPTb')) {
                setHigh(true);
                MonitorSet.clear();
              } else if (MonitorSet.has('cDIucGljPTX')) {
                setHigh(false);
                MonitorSet.clear();
              } else if (MonitorSet.has('cDAucGljPTf')) {
                setLevel(0);
                MonitorSet.clear();
              } else if (MonitorSet.has('cDAucGljPTj')) {
                setLevel(25);
                MonitorSet.clear();
              } else if (MonitorSet.has('cDAucGljPTn')) {
                setLevel(50);
                MonitorSet.clear();
              } else if (MonitorSet.has('cDAucGljPTEw')) {
                setLevel(75);
                MonitorSet.clear();
              } else if (MonitorSet.has('cDAucGljPTEx')) {
                setLevel(100);
                MonitorSet.clear();
              } else if (MonitorSet.has('cGFnZSBwYWdlMv')) {
                console.log('overfill22222222');
                MonitorSet.clear();
              }
            } else {
              console.log('no value');
            }
            subscription.remove();
          },
        );
      });
    });
  };

  if (Device) {
    getData();
  }

  const SetInitial = () => {
    setOn(false);
    setLevel(0);
  };

  const CheckState = () => {
    manager.onStateChange(state => {
      const permission_android = request(PERMISSIONS.ANDROID.BLUETOOTH_CONNECT);
      const permission_ios = request(PERMISSIONS.IOS.BLUETOOTH_PERIPHERAL);

      if (permission_ios || permission_android) {
        if (state === 'PoweredOff') {
          SetInitial();
            noConnectionAlert()
            setNotConnectedDialog(false)

          if (Platform.OS === 'android') {
            if (Platform.Version >= 29) {
              request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
            } else {
              request(PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION);
            }
          }
        }
      }
      setNotConnectedDialog(false)
      // connectToDevice();
    }, true);
  };

  const noConnectionAlert = () => {
          Alert.alert(
              'Bluetooth is off',
              'Please turn on bluetooth to use this app',
              [
                  {
                      text: 'OK',
                      onPress: () => {
                          if (Platform.OS === 'android') {
                              manager.enable();
                          } else if (Platform.OS === 'ios') {
                              // Linking.openURL('App-Prefs:root=Bluetooth');
                          }
                      },
                  },
              ],
          ), [manager.state()]
  }

  const showOverfillDialog = () => {
    if (OverfillDialog && Boo) {
      Alert.alert('OVERFILL', 'Drain Excess Water', [
        {
          text: 'OK',
          onPress: () => {
            setOverfillDialog(false);
          },
        },
      ]);
      setBoo(false);
    }
  };

  const OpenSettings = () => {
    if (Platform.OS === 'android') {
      manager.enable();
    } else if (Platform.OS === 'ios') {
      Linking.openURL('App-Prefs:root=Bluetooth');
    }
  };

  const disconnectDevice = () => {
    if (!isConnected) {
      console.log('not connected');
      return;
    }
    Device.cancelConnection();
    setIsConnected(false);
  };

  if (OverfillDialog) {
    showOverfillDialog();
  }

  const handlePress = () => {
    Linking.openURL(
      'https://errifire.com',
    );
  };

  React.useEffect(() => {
    CheckState();
  }, [NotConnectedDialog]);

  React.useEffect(() => {
    console.log(showDialog);
  }, [showDialog]);

  React.useEffect(() => {
    setPreviousState(isConnected);
  }, [isConnected]);

  React.useEffect(() => {
    if (isConnected !== PreviousState) {
      console.log(`count has changed from ${PreviousState} to ${isConnected}`);
      if (isConnected === false && PreviousState === true) {
        SetInitial();
      }
    }
  }, [isConnected, PreviousState]);

  const hideDialog = () => {
    setShowDialog(false);
  };


  return (
    <View>
          <ModalContainer style={{position: 'relative', right: 6}} onBackdropPress={hideDialog} isVisible={showDialog}>
              <ScrollView style={{width: '100%', top: '7.5%'}}>
                {devices.map(device => (
                  <View key={device.id} style={{top: '100%'}}>
                    <Text style={{color: 'white', fontSize: 21, top: 5, left: '10%'}}>{device.name}</Text>
                    <View style={{position: 'absolute', left: '73%'}}>
                    <Button
                        color={'red'}
                      title="Connect"
                      onPress={() => {
                        handleConnect(device)

                      }
                    }
                    />
                    </View>
                  </View>
                ))}

              </ScrollView>
            <View style={styles.closeDialog}>
            <TouchableOpacity
                style={{backgroundColor: 'black'}}
                // color={'white'}
                // title={'Close'}
                onPress={() => {
                  hideDialog();
                  manager.stopDeviceScan();
                }}>
                <Text style={{color: 'white', backgroundColor: 'transparent', fontSize: 30, borderRadius: 10}}>Close</Text>
            </TouchableOpacity>
            </View>
          </ModalContainer>
      <ImageBackground
        source={require('./assets/Background.png')}
        style={styles.image}
        imageStyle={styles.image_imageStyle}>

        <TouchableOpacity
          style={styles.image11}
          activeOpacity={0.3}
          disabled={!isConnected}
          onPress={() => {
            sendValue1();
          }}
          hitSlop={{top: -20, bottom: -20, left: -70, right: 150}}>
          <Image
            source={
              On
                ? require('./assets/ButtonOn.png')
                : require('./assets/ButtonOff.png')
            }
            resizeMode="contain"
            style={styles.image2}
          />
        </TouchableOpacity>

        <View style={styles.image4StackRow}>
          <View style={styles.image4Stack}>
            <Image
              source={
                Level === 0
                  ? require('./assets/Percentage0.png')
                  : Level === 25
                  ? require('./assets/Percentage25.png')
                  : Level === 50
                  ? require('./assets/Percentage50.png')
                  : Level === 75
                  ? require('./assets/Percentage75.png')
                  : Level === 100
                  ? require('./assets/Percentage100.png')
                  : require('./assets/Percentage0.png')
              }
              resizeMode="contain"
              style={styles.image4}
            />
            <Text style={styles.waterLevel}>WATER{'\n'}LEVEL</Text>
          </View>
          <TouchableOpacity
              style={styles.addDevice}
              activeOpacity={0.2}
              onPress={() => {
                setShowDialog(true);
                handleScan();
              }}
              hitSlop={{left: -25, bottom: -25, top: 0, right: -240}}>
            <Image
                source={require('./assets/DeviceAdd.png')}
                style={styles.image3}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.image12}
            activeOpacity={0.2}
            disabled={!On}
            onPress={() => {
              sendValue2();
            }}
            hitSlop={{left: 0, bottom: -25, top: 0, right: -130}}>
            <Image
              source={
                High
                  ? require('./assets/FlameHigh.png')
                  : require('./assets/FlameLow.png')
              }
              resizeMode="contain"
              style={On ? styles.image3 : styles.image3Off}
            />
          </TouchableOpacity>
          <Text style={On ? styles.flameIntensity : styles.flameIntensityOff}>
            FLAME{'\n'}INTENSITY
          </Text>
        </View>

        <TouchableOpacity
          style={styles.image5Touch}
          activeOpacity={0.7}
          onPress={handlePress}>
          <Image
            source={require('./assets/Logo.png')}
            resizeMode="contain"
            style={styles.image5}
          />
        </TouchableOpacity>
        <View style={styles.notConnected}>
          {!isConnected &&
              <TouchableOpacity
                  disabled={true}
                  onPress={OpenSettings}>
                <Text style={styles.notConnected1}>Not Connected</Text>
              </TouchableOpacity>
          }
        </View>
      </ImageBackground>
    </View>
  );
};


const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
  OverfillDialog: {
    width: '100%',
    height: '100%',
  },
  image_imageStyle: {},
  image11: {
    width: '40%',
    height: '30%',
    top: '10%',
    left: '2%',
    resizeMode: 'stretch',
  },
  image2: {
    width: '200%',
    height: '115%',
    left: '20%',
    bottom: '10%',
  },
  flameIntensity: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    fontSize: 16,
    position: 'absolute',
    bottom: '90%',
    left: '85%',
  },
  flameIntensityOff: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    fontSize: 16,
    position: 'absolute',
    bottom: '90%',
    left: '85%',
    opacity: 0.3,
  },
  image4: {
    top: '0%',
    left: '50%',
    width: '85%',
    height: '85%',
    position: 'absolute',
    opacity: 0.9,
  },
  waterLevel: {
    top: '75%',
    left: '75%',
    position: 'absolute',
    color: 'rgba(255,255,255,1)',
    textAlign: 'center',
    width: '100%',
    height: '100%',
    fontSize: 16,
    opacity: 0.7,
  },
  image4Stack: {
    width: '50%',
    height: '110%',
    top: '20%',
  },
  addDevice: {
    top: '160%',
    left: '75%',
    width: '85%',
    height: '85%',

    position: 'absolute',
  },
  image3: {
    width: '40%',
    height: '80%',
    resizeMode: 'contain',
    right: '3%',
    bottom: '3%',
  },
  image3Off: {
    width: '40%',
    height: '80%',
    resizeMode: 'contain',
    right: '3%',
    bottom: '3%',
    opacity: 0.3,
  },
  image12: {
    width: '50%',
    height: '85%',
    top: '6%',
    left: '110%',
    resizeMode: 'center',
  },
  image12Off: {
    width: '50%',
    height: '100%',
    top: '4%',
    left: '100%',
    resizeMode: 'center',
    opacity: 0.3,
  },
  image4StackRow: {
    height: '13%',
    width: '100%',
    flexDirection: 'row',
    right: '7.5%',
    top: '30%',
  },
  image5: {
    width: '140%',
    height: '110%',
    bottom: '15%',
    right: '20%',
  },
  notConnected: {
    position: 'absolute',
    textAlign: 'center',
    top: '77.5%',
    left: '35%'
  },
  notConnected1: {
    color: 'rgb(145,0,0)',
    fontSize: 17,
  },
  image5Touch: {
    width: '32.5%',
    height: '8%',
    alignSelf: 'center',
    top: '42.5%',
    right: '0%',
  },
  image6: {
    width: '10%',
    height: '10%',
    bottom: '92.5%',
    left: '0%',
    position: 'absolute',
  },
  imageNotConnected: {
    width: '50%',
    height: '80%',
    top: '72%',
    left: '24.5%',
  },
  addDeviceText: {
    position: 'absolute',
    bottom: 50,
    color: 'rgb(255,255,255)',
    fontSize: 100,
    left: '70%',
    opacity: 0.7,
  },
  closeDialog: {
    position: 'absolute',
    bottom: '25%',
    left: '42.5%',
    backgroundColor: 'rgb(38,38,38)',
  },
});

export default App;
