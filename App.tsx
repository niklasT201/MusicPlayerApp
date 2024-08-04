/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useState, useEffect } from 'react';
import {SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, useColorScheme, View, FlatList, TouchableOpacity, PermissionsAndroid, Platform,} from 'react-native';
import Sound from 'react-native-sound';
import RNFS, { ReadDirItem } from 'react-native-fs';

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
    // Request storage permission on Android
    if (Platform.OS === 'android') {
      PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
      ).then((granted) => {
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          loadSongs();
        } else {
          console.log('Storage permission denied');
        }
      });
    } else {
      loadSongs();
    }
  }, []);

  const loadSongs = () => {
    RNFS.readDir(RNFS.ExternalStorageDirectoryPath)
      .then((result: ReadDirItem[]) => {
        const mp3Files = result.filter(file => file.isFile() && file.name.endsWith('.mp3'));
        const songItems: SongItem[] = mp3Files.map(file => ({
          name: file.name,
          path: file.path,
        }));
        setSongs(songItems);
      })
      .catch((err) => {
        console.log(err.message, err.code);
      });
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.title}>Music Player</Text>
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
  songItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  songTitle: {
    fontSize: 18,
  },
});

export default App;
