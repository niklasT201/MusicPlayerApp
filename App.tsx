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
  Modal,
  Image,
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
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const [currentSongItem, setCurrentSongItem] = useState<SongItem | null>(null);

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

  const playSong = (filePath: string, songItem: SongItem) => {
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
      setCurrentSongItem(songItem);
      setShowNowPlaying(true);
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
      setIsPlaying(!isPlaying);
    }
  };

  const togglePlayPause = () => {
    if (currentSong) {
      if (isPlaying) {
        currentSong.pause();
      } else {
        currentSong.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const nextSong = () => {
    const currentIndex = songs.findIndex(song => song.path === currentSongItem?.path);
    if (currentIndex < songs.length - 1) {
      const nextSong = songs[currentIndex + 1];
      playSong(nextSong.path, nextSong);
    }
  };

  const previousSong = () => {
    const currentIndex = songs.findIndex(song => song.path === currentSongItem?.path);
    if (currentIndex > 0) {
      const prevSong = songs[currentIndex - 1];
      playSong(prevSong.path, prevSong);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.title}>AudioFlow</Text>
      </View>
      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.selectButton} onPress={handlePickDirectory}>
          <Text style={styles.selectButtonText}>Select Directory</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={songs}
        keyExtractor={(item) => item.path}
        renderItem={({ item }) => (
          <TouchableOpacity 
            onPress={() => playSong(item.path, item)} 
            style={styles.songItem}
          >
            <Text style={styles.songTitle}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
      <Modal
        animationType="slide"
        transparent={false}
        visible={showNowPlaying}
        onRequestClose={() => setShowNowPlaying(false)}
      >
        <View style={styles.nowPlayingContainer}>
          <View style={styles.albumArtContainer}>
            <View style={styles.albumArt} />
          </View>
          <Text style={styles.nowPlayingTitle}>{currentSongItem?.name}</Text>
          <View style={styles.controls}>
            <TouchableOpacity onPress={previousSong} style={styles.controlButton}>
              <Text style={styles.controlButtonText}>Previous</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={togglePlayPause} style={styles.controlButton}>
              <Text style={styles.controlButtonText}>{isPlaying ? 'Pause' : 'Play'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={nextSong} style={styles.controlButton}>
              <Text style={styles.controlButtonText}>Next</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity 
            onPress={() => setShowNowPlaying(false)}
            style={styles.closeButton}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    padding: 16,
    backgroundColor: '#1E1E1E',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  inputContainer: {
    padding: 16,
    backgroundColor: '#1E1E1E',
  },
  selectButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1DB954',
    padding: 12,
    borderRadius: 25,
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  songItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  songTitle: {
    fontSize: 16,
    color: '#fff',
  },
  nowPlayingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121212',
  },
  albumArtContainer: {
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  albumArt: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#4A4A4A',
  },
  nowPlayingTitle: {
    fontSize: 20,
    color: '#fff',
    marginBottom: 30,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '80%',
  },
  controlButton: {
    backgroundColor: '#1DB954',
    padding: 10,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  closeButton: {
    marginTop: 30,
    backgroundColor: '#4A4A4A',
    padding: 10,
    borderRadius: 20,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default App;

// AudioFlow App Name