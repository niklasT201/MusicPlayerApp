/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  PermissionsAndroid,
  Platform,
  Button,
  Alert,
} from 'react-native';
import Sound from 'react-native-sound';
import RNFS, { ReadDirItem } from 'react-native-fs';
import DocumentPicker from 'react-native-document-picker';

// Define a type for the song items
interface SongItem {
  name: string;
  path: string;
}

const App = () => {
  // Define the state with the correct type
  const [songs, setSongs] = useState<SongItem[]>([]);
  const [currentSong, setCurrentSong] = useState<Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    console.log('App started');
    if (Platform.OS === 'android') {
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE)
        .then(hasPermission => {
          if (hasPermission) {
            console.log('Storage permission already granted');
            loadSongs();
          } else {
            console.log('Requesting storage permission');
            PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
            ).then((granted) => {
              console.log('Permission result:', granted);
              if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                loadSongs();
              } else {
                console.log('Storage permission denied');
              }
            });
          }
        });
    } else {
      loadSongs();
    }
  }, []);

  const loadSongs = async (additionalPath = '') => {
    const directories = [
      RNFS.ExternalStorageDirectoryPath,
      `${RNFS.ExternalStorageDirectoryPath}/Music`,
      `${RNFS.ExternalStorageDirectoryPath}/Download`,
      `${RNFS.ExternalStorageDirectoryPath}/Download/Rap`,
    ];

    // Include custom path if provided
    if (additionalPath) {
      directories.push(additionalPath);
    }

    let allSongs: SongItem[] = [];

    for (const dir of directories) {
      try {
        console.log(`Attempting to read directory: ${dir}`);
        const dirExists = await RNFS.exists(dir);
        if (!dirExists) {
          console.log(`Directory does not exist: ${dir}`);
          continue;
        }
        const files = await RNFS.readDir(dir);
        if (files && files.length > 0) {
          console.log(`Files found in ${dir}:`, files.length);
          const mp3Files = files.filter(file => file.isFile() && file.name.toLowerCase().endsWith('.mp3'));
          console.log(`MP3 files found in ${dir}:`, mp3Files.length);
          allSongs = allSongs.concat(mp3Files.map(file => ({
            name: file.name,
            path: file.path,
          })));
        } else {
          console.log(`No files found in ${dir}`);
        }
      } catch (err) {
        console.log(`Error reading ${dir}:`, err);
      }
    }

    console.log('Total songs found:', allSongs.length);
    setSongs(allSongs);
  };

  const playSong = (filePath: string) => {
    if (currentSong) {
      currentSong.stop(() => currentSong.release());
      setIsPlaying(false);
    }
    const sound = new Sound(filePath, '', (error) => {
      if (error) {
        console.log('Failed to load sound', error);
        return;
      }
      sound.play((success) => {
        if (success) {
          console.log('Playback finished');
        } else {
          console.log('Playback failed');
        }
        setIsPlaying(false);
        sound.release();
      });
      setCurrentSong(sound);
      setIsPlaying(true);
    });
  };

  const handlePickDirectory = async () => {
    try {
      const res = await DocumentPicker.pickDirectory();
      if (res) {
        console.log('Selected directory:', res);
        loadSongs(res.uri.replace('file://', ''));
      }
    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        console.log('User cancelled directory picker');
      } else {
        console.error('Unknown error:', err);
        Alert.alert('Error', 'An error occurred while selecting a directory.');
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.title}>AudioFlow</Text>
      </View>
      <View style={styles.inputContainer}>
        <Button title="Select Directory" onPress={handlePickDirectory} />
      </View>
      <FlatList
        data={songs}
        keyExtractor={(item) => item.path}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => playSong(item.path)} style={styles.songItem}>
            <Text style={styles.songTitle}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  inputContainer: {
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  songItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    backgroundColor: '#f5f5f5',
  },
  songTitle: {
    fontSize: 18,
    color: '#333',
  },
});

export default App;

// AudioFlow App Name