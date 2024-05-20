// fileManager.js
import * as FileSystem from 'expo-file-system';

export const downloadFile = async (url, fileName) => {
  const fileUri = FileSystem.documentDirectory + fileName;
  const downloadResumable = FileSystem.createDownloadResumable(
    url,
    fileUri,
    {},
    downloadProgress => {
      const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
      console.log(`Download Progress: ${progress.toFixed(4)}`);
    }
  );

  try {
    const { uri } = await downloadResumable.downloadAsync();
    console.log('File downloaded to:', uri);
    return uri;
  } catch (e) {
    console.error('Error downloading file:', e);
  }
};
