// UploadAndCapture.js
import React, { useState, useEffect } from 'react';
import { ScrollView,Button, Text, View, Platform, ActivityIndicator,StyleSheet, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as tf from '@tensorflow/tfjs';
import { FontAwesome5 } from '@expo/vector-icons';
import { decodeJpeg, bundleResourceIO } from '@tensorflow/tfjs-react-native';
import { FIREBASE_DB } from './FirebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';

const modelJson = require('./assets/model/model.json');
const modelWeights = require('./assets/model/weights.bin');

const UploadAndCapture = ({ navigation }) => {
  const [result, setResult] = useState('');
  const [data, setData] = useState([]);
  const [model, setModel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [additionalInfo, setAdditionalInfo] = useState('');

  useEffect(() => {
    (async () => {
      await tf.ready();
      // Load your model. Adjust paths as necessary.
      const loadedModel = await tf.loadLayersModel(bundleResourceIO(modelJson, modelWeights));
      setModel(loadedModel);
      console.log('Model loaded.');

      // Request camera roll permissions from the user.
      if (Platform.OS !== 'web') {
        const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
        
        if (libraryPermission.status !== 'granted' || cameraPermission.status !== 'granted') {
          alert('Sorry, we need camera and camera roll permissions to make this work!');
        }
      }
    })();
  }, []);

  const handleImageAndPredict = async (source) => {
    setLoading(true);
    setResult('');
    setAdditionalInfo('');

    let pickerResult;
    if (source === 'camera') {
      pickerResult = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
        base64: true
      });
    } else {
      pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
        base64: true
      });
    }

    try {
      if (!pickerResult.cancelled && pickerResult.assets && pickerResult.assets.length && pickerResult.assets.every(img => img.base64 != null)) {
        const imageTensor = decodeJpeg(tf.util.encodeString(pickerResult.assets[0].base64, 'base64'));
        const processedImage = preprocessImage(imageTensor);
        const {predictionMsg, predictedClass} = await makePrediction(processedImage);
        setResult(predictionMsg);
        // Fetch additional information from Firestore
        const additionalInfo = predictedClass != null && await fetchAdditionalInfo(predictedClass);
        setAdditionalInfo(additionalInfo);
      } else {
        console.log('No image picked or missing base64 data');
        setResult('No image picked or missing base64 data');
      }
    } catch (error) {
      console.error(error);
      setResult('An error occurred during prediction');
    } finally {
      setLoading(false);
    }
  };

  const preprocessImage = (imageTensor) => {
    const resizedImage = tf.image.resizeBilinear(imageTensor, [224, 224]);
    return resizedImage.div(255.0).expandDims(0);
  };

  const makePrediction = async (image) => {
    if (!model) {
      return {predictionMsg: 'Model not loaded yet', predictedClass: null};
    }
    const predictions = await model.predict(image).data();
    //const classes = ['Salwa Palace', 'Kaf Palace', 'Zabel Palace', 'Mared Palace', 'Almasmaq Palace', 'Al-Waziya Palace', 'Wall of Dalam', 'eayn alnajm', 'Ibrahim Palace', 'muraqab raghba'];
    const classes = [
      "Alwizaya palace", "A wall painting from the first century BC", "The historical Almurabae palace", "albuyut altiyniat fi hayi almarabae", "suq alqaysaria", "sur aldilam", "sadu alsabein birawdat sadir", "eayn alnajm", "Almasmak palace", "Marid palace",
      "Zaebal palace", "Al-Shanana Tower in Al-Rass", "Uhud Castle", "Al Kut Tower", "Historic Jeddah", "almaraqab aljanubiu bishaqra", "kaf palace", "The historic muraqab raghbat", "Salwa Palace", "Ibrahim Palace",
      "aleayn alqawsiat - eayan faraj", "The historic castle of Urwa bin Al-Zubair palaces", "Al Khubara Heritage Town", "Shamsan Castle", "Tabuk Heritage Castle", "Alqara Mountain", "AIUla Heritage Town", "Jubaila Police Station", "Mount Munikh Observatory", "The heritage town of Oyoun Al-Jawa",
      "Ghaseiba neighborhood", "Turaif neighborhood", "King Abdulaziz Historical Center", "Imam Turki bin Abdullah Castle", "King Abdulaziz Castle in Duba", "Historical Shada Palace", "Historical Khuzam Palace", "Khuzam Palace in Al-Ahsa", "Al-Dahou neighborhood", "Al-Bujairi neighborhood",
      "The town's heritage castle in Al-Wajh", "Al-Turaif bathroom", "Alamara Palace in Ghat", "Dhi Ain Heritage Village", "Al-amara Palace in Al-Issawiya", "Almajlis Heritage Market in Shaqra", "Al-Qashla Palace", "The historic King Abdulaziz Palace in Wadi Al-Dawa", "King Abdulaziz Palace in Quba", "The historic King Abdulaziz Palace in Lina Center",
      "Gold bracelets from Thaj Treasure", "Copper astrolabe", "Gilded silver tableware", "Patterned limestone slab", "Pottery vessel dating back to the fifth millennium", "A pottery bowl from the Tayma civilization", "Stone inscription from the tenth century AD", "A precious necklace made of gold pearls and rubies", "Lahyani Statue from the 4th century", "Statue of the King of Lihyan from the 4 century BC",
      "A necklace made of bone and shells from 7th BC", "Statue of suffering man", "Latch for the Alhujra alsharifa", "Camel statue", "A precious porcelain statue", "Tombstone from the third century AH", "Statue of a woman dating from first century AD", "7,000-year-old fossilized scrapers and axes", "Monument of dhat aleuyun", "A lamp made of gilded copper",
      "9000 year old horse figure", "A silver cup from the Al-Faw civilization", "Lion mask from the 2nd century AD", "Statue decorated with precious stones", "Head of a statue dating back to the 4th century BC", "Saluki head and body", "A silver dirham from the Abbasid era", "Glass perfume bottle", "Small statue from the 3rd century BC", "Almarmar statue of a man",
      "Tombstone from Mecca", "Date-shaped bottle", "A manuscript of the Qur'an", "A rare manuscript of the Holy Qur'an", "A mural dating back to the first century BC", "Aaref Castle", "King Abdulaziz stood in the center of Al Majmaah", "Al Uqair Heritage Port", "King Abdulaziz Palace in Haddad", "The governorate building in the town of Al-Ula"
    ];

    const highestPredictionIndex = predictions.indexOf(Math.max(...predictions));
    const highestPredictionValue = predictions[highestPredictionIndex];
    const threshold = 0.5; // Adjust this threshold based on your needs

    if (highestPredictionValue > threshold) {
        return {predictionMsg: `${classes[highestPredictionIndex]} has been recognized`, predictedClass: classes[highestPredictionIndex]};
    } else {
        return {predictionMsg: 'Heritage not recognized', predictedClass: null};
    }
  };

  const fetchAdditionalInfo = async (predictedClass) => {
    try {
      const q = query(collection(FIREBASE_DB, 'model'), where('Id', '==', predictedClass));
      const querySnapshot = await getDocs(q);
      const results = [];

      querySnapshot.forEach((doc) => {
        results.push(doc.data());
      });

      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        setData(results);
        return doc.data().Description || 'No additional information found';
      } else {
        return 'No additional information found';
      }
    } catch (error) {
      console.error(error);
      return 'Error fetching additional information';
    }
  };

 // return (
    // <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    //   <Button title="Select Image from Library" onPress={() => handleImageAndPredict('library')} disabled={loading || !model} />
    //   <View style={{ height: 20 }} />
    //   <Button title="Capture Image with Camera" onPress={() => handleImageAndPredict('camera')} disabled={loading || !model} />
    //   {loading ? (
    //     <ActivityIndicator size="large" color="#0e1457" style={{ marginTop: 20 }} />
    //   ) : (
    //     <>
    //       <Text style={{ marginTop: 20 }}>{result}</Text>
    //       {additionalInfo ? <Text>{additionalInfo}</Text> : null}
    //     </>
    //   )}
    // </View>
    return (
      <View style={styles.container}>
        <ScrollView>
        <View style={styles.header}>
        <Image
          source={require('./assets/logo.png')} // Update the path to your logo
          style={styles.logo}
        />
      </View>
        <View style={styles.iconContainer}>
          <FontAwesome5
            name="camera-retro"
            size={35}
            color="black"
            onPress={() => handleImageAndPredict('camera')} disabled={loading || !model}
            style={styles.icon}
          />
          <Text style={styles.resultText}>{result}</Text>
          <FontAwesome5
            name="image"
            size={35}
            color="black"
            onPress={() => handleImageAndPredict('library')} disabled={loading || !model}
            style={styles.icon}
          />
        </View>
        {/* {loading ? (
        <ActivityIndicator size="large" color="#0e1457" style={styles.loadingIndicator} />
      ) //: (
       // additionalInfo ? <Text style={styles.additionalInfo}>{additionalInfo}</Text> : null
    
    } */}
      {data.length > 0 ? (
        data.map((item, index) => (
          <View key={index} style={styles.item}>
            <Text style={styles.title}>{item.Name}</Text>
            <Text style={styles.description}>{item.Description}</Text>
            <Image 
              source={{ uri: item.Image }}
              style={styles.image}
            />
          </View>
        ))
      ) : (
        <Text style={styles.noData}>No data available</Text>
      )}
      </ScrollView>
    </View>
    );
  };
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#FAF3E0',
    },
    header: {
      width: '100%',
      alignItems: 'center',
      //top:-100,
      marginVertical: 0,
    },
    logo: {
      width: 200,
      height: 200,
      resizeMode: 'contain',
    },
    item: {
      backgroundColor: '#9DBABB',
      padding: 20,
      marginVertical: 40,
      borderRadius: 15,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 5,
    },
    title: {
      fontSize: 22,
      fontWeight:'bold',
      textAlign: 'center',
      marginVertical: 10,
      
    },
    description: {
      fontSize: 16,
      textAlign: 'center',
      marginVertical: 10,
    },
    image: {
      width: '100%',
      height: 200,
      borderRadius: 10,
      marginVertical: 10,
    },
    noData: {
      fontSize: 16,
      textAlign: 'center',
      marginVertical: 20,
      color: '#999',
    },
    iconContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '80%',
      marginBottom: 20,
      marginLeft:30,
    },
    icon: {
      padding: 0,
      alignItems:'center',
      
    },
    resultText: {
      flex: 1,
      paddingHorizontal: 10,
      textAlign: 'center',
      fontSize: 16,
      color: '#333',
      backgroundColor: '#FDF6E4',
      borderRadius: 10,
    },
    loadingIndicator: {
      marginTop: 20,
    },
    additionalInfo: {
      padding: 15,
      backgroundColor: '#FDF6E4',
      margin: 10,
      borderRadius: 10,
      fontSize: 16,
      color: '#333',
      textAlign: 'center',
    }
  });

export default UploadAndCapture;