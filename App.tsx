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
import Slider from '@react-native-community/slider';

// Define a type for the song items
interface SongItem {
  name: string;
  path: string;
  artist?: string;
  coverArtUrl?: string;
  album?: string;
}

const App = () => {
  // Define the state with the correct type
  const [songs, setSongs] = useState<SongItem[]>([]);
  const [currentSong, setCurrentSong] = useState<Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const [currentSongItem, setCurrentSongItem] = useState<SongItem | null>(null);

  // Add these states to manage progress and duration
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);

    // Function to update progress and duration
    const updateProgress = () => {
      if (currentSong) {
        currentSong.getCurrentTime(seconds => setProgress(seconds));
        setDuration(currentSong.getDuration());
      }
    };

    // Start interval for progress updates
    useEffect(() => {
      const interval = setInterval(updateProgress, 1000);
      return () => clearInterval(interval);
    }, [currentSong]);


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
      `${RNFS.ExternalStorageDirectoryPath}/Download/Music`,
      `${RNFS.ExternalStorageDirectoryPath}/Download/Musik`,
      `${RNFS.ExternalStorageDirectoryPath}/Downloads`,
      `${RNFS.ExternalStorageDirectoryPath}/Downloads/Music`,
      `${RNFS.ExternalStorageDirectoryPath}/Downloads/Musik`,
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
      <StatusBar backgroundColor="#1E1E1E" barStyle="light-content" />
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
          <TouchableOpacity onPress={() => playSong(item.path, item)} style={styles.songItem}>
            {item.coverArtUrl ? (
              <Image source={{ uri: item.coverArtUrl }} style={styles.songCoverArt} />
            ) : (
              <View style={styles.defaultCoverArt}>
                <Text style={styles.defaultCoverArtText}>No Cover Art</Text>
              </View>
            )}
            <View style={styles.songInfo}>
              <Text style={styles.songTitle}>{item.name}</Text>
              {item.artist && <Text style={styles.songArtist}>{item.artist}</Text>}
            </View>
          </TouchableOpacity>
        )}
      />
      <Modal
        animationType="slide"
        transparent={true}
        visible={showNowPlaying}
        onRequestClose={() => setShowNowPlaying(false)}
      >
        <View style={styles.nowPlayingContainer}>
        <StatusBar backgroundColor="#121212" barStyle="light-content" />
          {currentSongItem?.coverArtUrl ? (
            <Image source={{ uri: currentSongItem.coverArtUrl }} style={styles.nowPlayingCoverArt} />
          ) : (
            <View style={styles.defaultNowPlayingCoverArt}>
              <Text style={styles.defaultCoverArtText}>No Cover Art</Text>
            </View>
          )}
          <Text style={styles.nowPlayingTitle}>{currentSongItem?.name}</Text>
          {currentSongItem?.artist && <Text style={styles.nowPlayingArtist}>{currentSongItem.artist}</Text>}
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
          <Slider
              style={{ width: '80%', height: 40 }}
              minimumValue={0}
              maximumValue={duration}
              value={progress}
              minimumTrackTintColor="#1DB954"
              maximumTrackTintColor="#fff"
              thumbTintColor="#1DB954"
              onValueChange={(value) => {
                if (currentSong) {
                  currentSong.setCurrentTime(value);
                  setProgress(value);
                }
              }}
            />
            <View style={styles.timeContainer}>
              <Text style={styles.timeText}>{new Date(progress * 1000).toISOString().substr(11, 8)}</Text>
              <Text style={styles.timeText}>{new Date(duration * 1000).toISOString().substr(11, 8)}</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  songCoverArt: {
    width: 60,
    height: 60,
    borderRadius: 5,
    marginRight: 16,
  },
  defaultCoverArt: {
    width: 60,
    height: 60,
    borderRadius: 5,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  defaultCoverArtText: {
    color: '#fff',
    fontSize: 12,
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
  },
  songArtist: {
    fontSize: 14,
    color: '#aaa',
  },
  nowPlayingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121212',
  },
  nowPlayingCoverArt: {
    width: 240,
    height: 240,
    borderRadius: 120,
    marginBottom: 20,
  },
  defaultNowPlayingCoverArt: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  nowPlayingTitle: {
    fontSize: 24,
    color: '#fff',
    marginBottom: 8,
  },
  nowPlayingArtist: {
    fontSize: 18,
    color: '#aaa',
    marginBottom: 20,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '80%',
    marginBottom: 10,
    marginTop: 40,
  },
  controlButton: {
    backgroundColor: '#1DB954',
    padding: 10,
    borderRadius: 20,
    alignItems: 'center',
    minWidth: 80,
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
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
    marginTop: 10,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
  },
});

export default App;

// AudioFlow App Name