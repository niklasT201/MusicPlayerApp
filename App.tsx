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
  ScrollView,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  PermissionsAndroid,
  Platform,
  Image,
  Modal,
  Alert,
} from 'react-native';
import TrackPlayer, { Capability, usePlaybackState, State } from 'react-native-track-player';
import RNFS from 'react-native-fs';
import DocumentPicker from 'react-native-document-picker';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';


interface SongItem {
  name: string;
  path: string;
  artist?: string;
  coverArtUrl?: string;
  album?: string;
}

interface Folder {
  name: string;
  path: string;
}
const service = require('./service'); // Adjust the path if necessary

const App = () => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [songs, setSongs] = useState<SongItem[]>([]);
  const [currentSongItem, setCurrentSongItem] = useState<SongItem | null>(null);
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showMiniPlayer, setShowMiniPlayer] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);

  const playbackState = usePlaybackState();
  const isPlaying = playbackState.state !== undefined && playbackState.state === State.Playing;

  useEffect(() => {
    setup();
  }, []);

  const setup = async () => {
    await TrackPlayer.setupPlayer();
    TrackPlayer.updateOptions({
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.Stop,
      ],
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
      ],
    });

    service();

    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        loadFolders();
      } else {
        console.log('Storage permission denied');
      }
    } else {
      loadFolders();
    }

    const interval = setInterval(updateProgress, 1000);
    return () => clearInterval(interval);
  };

  const loadFolders = async () => {
    try {
      const cachedFolders = await AsyncStorage.getItem('musicFolders');
      if (cachedFolders) {
        setFolders(JSON.parse(cachedFolders));
      } else {
        const musicFolders = await scanForMusicFolders();
        setFolders(musicFolders);
        await AsyncStorage.setItem('musicFolders', JSON.stringify(musicFolders));
      }
    } catch (error) {
      console.error('Error loading folders:', error);
    }
  };

  const scanForMusicFolders = async (): Promise<Folder[]> => {
    const rootDirs = [
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

    let musicFolders: Folder[] = [];
    const addedPaths = new Set<string>();

    for (const dir of rootDirs) {
      await scanDirectory(dir, musicFolders, addedPaths);
    }

    return musicFolders;
  };

  const scanDirectory = async (dirPath: string, musicFolders: Folder[], addedPaths: Set<string>) => {
    try {
      const files = await RNFS.readDir(dirPath);
      const hasMp3 = files.some(file => file.name.toLowerCase().endsWith('.mp3'));

      if (hasMp3 && !addedPaths.has(dirPath)) {
        musicFolders.push({ name: dirPath.split('/').pop() || '', path: dirPath });
        addedPaths.add(dirPath);
      }

      for (const file of files) {
        if (file.isDirectory()) {
          await scanDirectory(file.path, musicFolders, addedPaths);
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dirPath}:`, error);
    }
  };

  const loadSongsForFolder = async (folder: Folder) => {
    try {
      const files = await RNFS.readDir(folder.path);
      const mp3Files = files
        .filter(file => file.isFile() && file.name.toLowerCase().endsWith('.mp3'))
        .map(file => ({ name: file.name, path: file.path }));
      setSongs(mp3Files);
      setCurrentFolder(folder);
      await setupTrackPlayer(mp3Files);
    } catch (error) {
      console.error('Error loading songs:', error);
    }
  };

  const setupTrackPlayer = async (songs: SongItem[]) => {
    await TrackPlayer.reset();
    const trackItems = songs.map(song => ({
      id: song.path,
      url: song.path,
      title: song.name,
      artist: song.artist || 'Unknown Artist',
      artwork: song.coverArtUrl,
    }));
    await TrackPlayer.add(trackItems);
  };

  const updateProgress = () => {
    TrackPlayer.getPosition().then(position => setProgress(position));
    TrackPlayer.getDuration().then(duration => setDuration(duration));
  };

  const playSong = async (song: SongItem) => {
    const index = songs.findIndex(s => s.path === song.path);
    if (index !== -1) {
      await TrackPlayer.skip(index);
      await TrackPlayer.play();
      setCurrentSongItem(song);
      setShowMiniPlayer(true);
    }
  };

  const togglePlayPause = async () => {
    const state = await TrackPlayer.getState();
    if (state === State.Playing) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  };

  const nextSong = async () => {
    try {
      await TrackPlayer.skipToNext();
    } catch (_) {
      console.log('No next track available');
    }
  };

  const previousSong = async () => {
    try {
      await TrackPlayer.skipToPrevious();
    } catch (_) {
      console.log('No previous track available');
    }
  };

  const sortSongs = (order: 'asc' | 'desc') => {
    const sortedSongs = [...songs].sort((a, b) => {
      if (order === 'asc') {
        return a.name.localeCompare(b.name);
      } else {
        return b.name.localeCompare(a.name);
      }
    });
    setSongs(sortedSongs);
    setSortOrder(order);
  };

  const toggleFullPlayer = () => {
    setShowNowPlaying(!showNowPlaying);
  };

  const handlePickDirectory = async () => {
    try {
      const res = await DocumentPicker.pickDirectory();
      if (res) {
        const folderName = res.uri.split('/').pop() || 'Selected Folder';
        loadSongsForFolder({
          name: folderName,
          path: res.uri.replace('file://', '')
        });
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

  const renderFolder = ({ item }: { item: Folder }) => (
    <TouchableOpacity onPress={() => loadSongsForFolder(item)} style={styles.songItem}>
      <Text style={styles.songTitle}>{item.name}</Text>
    </TouchableOpacity>
  );

  const renderSong = ({ item }: { item: SongItem }) => (
    <TouchableOpacity onPress={() => playSong(item)} style={styles.songItem}>
      <Text style={styles.songTitle}>{item.name}</Text>
    </TouchableOpacity>
  );

  const renderSortButton = () => (
    <TouchableOpacity
      style={styles.sortButton}
      onPress={() => sortSongs(sortOrder === 'asc' ? 'desc' : 'asc')}
    >
      <Text style={styles.sortButtonText}>
        Sort {sortOrder === 'asc' ? '↓' : '↑'}
      </Text>
    </TouchableOpacity>
  );

  const renderMiniPlayer = () => (
    <TouchableOpacity 
    style={styles.miniPlayer} 
    onPress={toggleFullPlayer}
    activeOpacity={1} // This prevents the transparency effect
  >
      {currentSongItem?.coverArtUrl ? (
        <Image source={{ uri: currentSongItem.coverArtUrl }} style={styles.miniPlayerCoverArt} />
      ) : (
        <View style={styles.miniPlayerDefaultCoverArt}>
          <Text style={styles.miniPlayerDefaultCoverArtText}>No Cover</Text>
        </View>
      )}
      <View style={styles.miniPlayerInfo}>
        <Text style={styles.miniPlayerTitle} numberOfLines={1}>{currentSongItem?.name}</Text>
        <Text style={styles.miniPlayerArtist} numberOfLines={1}>{currentSongItem?.artist || 'Unknown Artist'}</Text>
      </View>
      <TouchableOpacity onPress={togglePlayPause} style={styles.miniPlayerControl}>
        <Image
          source={isPlaying ? require('./assets/stop-button.png') : require('./assets/play-button.png')}
          style={styles.miniPlayerControlIcon}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>AudioFlow</Text>
      <View style={styles.headerIcons}>
        {currentFolder && (
          <TouchableOpacity onPress={() => setCurrentFolder(null)} style={styles.headerButton}>
            <Image source={require('./assets/Folder.png')} style={styles.headerIcon} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={handlePickDirectory} style={styles.headerButton}>
          <Image source={require('./assets/add.png')} style={styles.addheaderIcon} />
        </TouchableOpacity>
        {currentFolder && (
          <TouchableOpacity 
            onPress={() => sortSongs(sortOrder === 'asc' ? 'desc' : 'asc')} 
            style={styles.headerButton}
          >
            <Image 
              source={sortOrder === 'asc' ? require('./assets/arrow-up.png') : require('./assets/arrow-down.png')} 
              style={styles.headerIcon} 
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1E1E1E" barStyle="light-content" />
      {renderHeader()}
      {currentFolder ? (
        <>
          <FlatList
            data={songs}
            renderItem={renderSong}
            keyExtractor={(item) => item.path}
            style={styles.list}
            contentContainerStyle={showMiniPlayer ? { paddingBottom: 70 } : undefined}
          />
        </>
      ) : (
        <FlatList
          data={folders}
          renderItem={renderFolder}
          keyExtractor={(item, index) => `${item.path}_${index}`}
          style={styles.list}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={showMiniPlayer ? { paddingBottom: 70 } : undefined}
        />
      )}
      {showMiniPlayer && renderMiniPlayer()}
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
          <View style={styles.nowPlayingTextContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Text style={styles.nowPlayingTitle}>{currentSongItem?.name}</Text>
            </ScrollView>
            <Text style={styles.nowPlayingArtist}>{currentSongItem?.artist || 'Unknown Artist'}</Text>
          </View>
          <Slider
            style={{ width: '90%', height: 40 }}
            minimumValue={0}
            maximumValue={duration}
            value={progress}
            minimumTrackTintColor="#1DB954"
            maximumTrackTintColor="#fff"
            thumbTintColor="#1DB954"
            onValueChange={(value) => {
              TrackPlayer.seekTo(value);
              setProgress(value);
            }}
          />
          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>{new Date(progress * 1000).toISOString().substr(11, 8)}</Text>
            <Text style={styles.timeText}>{new Date(duration * 1000).toISOString().substr(11, 8)}</Text>
          </View>
          <View style={styles.controls}>
            <TouchableOpacity onPress={() => console.log('Cycle button pressed')} style={styles.controlButton}>
              <Image source={require('./assets/repeat.png')} style={styles.repeatcontrolIcon} />
            </TouchableOpacity>
            <TouchableOpacity onPress={previousSong} style={styles.controlButton}>
              <Image source={require('./assets/back.png')} style={styles.controlIcon} />
            </TouchableOpacity>
            <TouchableOpacity onPress={togglePlayPause} style={styles.controlButton}>
              <Image
                source={isPlaying ? require('./assets/stop-button.png') : require('./assets/play-button.png')}
                style={styles.startcontrolIcon}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={nextSong} style={styles.controlButton}>
              <Image source={require('./assets/next.png')} style={styles.controlIcon} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => console.log('Cycle button pressed')} style={styles.controlButton}>
              <Image source={require('./assets/shuffle.png')} style={styles.shufflecontrolIcon} />
            </TouchableOpacity>
          </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1E1E1E',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerIcons: {
    flexDirection: 'row',
  },
  headerButton: {
    marginLeft: 16,
  },
  headerIcon: {
    width: 24,
    height: 24,
    tintColor: '#fff', // This will color the icon white. Remove if not needed.
  },
  addheaderIcon: {
    width: 30,
    height: 30,
    tintColor: '#fff', // This will color the icon white. Remove if not needed.
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
  nowPlayingTextContainer: {
    width: '80%',
    alignItems: 'flex-start',
    marginBottom: 20,
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
    marginBottom: 70,
  },
  nowPlayingTitle: {
    fontSize: 24,
    color: '#fff',
    marginBottom: 8,
  },
  nowPlayingArtist: {
    fontSize: 18,
    color: '#aaa',
    marginBottom: 10,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
    marginTop: 20,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatcontrolIcon: {
    width: 25,
    height: 25,
    tintColor: '#fff', // Optional: Set tintColor if you want to color the icons
  },
  startcontrolIcon: {
    width: 70,
    height: 70,
    tintColor: '#fff', // Optional: Set tintColor if you want to color the icons
  },
  shufflecontrolIcon: {
    width: 25,
    height: 25,
    tintColor: '#fff', // Optional: Set tintColor if you want to color the icons
  },
  controlIcon: {
    width: 40,
    height: 40,
    tintColor: '#fff', // Optional: Set tintColor if you want to color the icons
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  slider: {
    width: '80%',
    height: 40,
    alignSelf: 'center',
    marginVertical: 20,
  },
  closeButton: {
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
  backButton: {
    padding: 10,
    backgroundColor: '#1DB954',
    margin: 10,
    borderRadius: 5,
  },
  backButtonText: {
    color: '#fff',
    textAlign: 'center',
  },
  miniPlayer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: '#1E1E1E',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  miniPlayerCoverArt: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 10,
  },
  miniPlayerDefaultCoverArt: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  miniPlayerDefaultCoverArtText: {
    color: '#fff',
    fontSize: 10,
  },
  miniPlayerInfo: {
    flex: 1,
  },
  miniPlayerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  miniPlayerArtist: {
    color: '#aaa',
    fontSize: 14,
  },
  miniPlayerControl: {
    padding: 10,
  },
  miniPlayerControlIcon: {
    width: 30,
    height: 30,
    tintColor: '#fff',
  },
  list: {
    flex: 1,
  },
  sortButton: {
    backgroundColor: '#1DB954',
    padding: 10,
    borderRadius: 5,
    marginLeft: 10,
    marginTop: 10,
  },
  sortButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  folderIcon: {
    width: 40,
    height: 40,
    marginRight: 10,
    tintColor: '#fff',
  },
});

export default App;

// AudioFlow App Name