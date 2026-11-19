import { Directory, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { actions, getState } from './store';

/**
 * «تحميل PDF»: puts a real copy of the PDF in a folder the student can see
 * (Downloads by default; Android asks once which folder to use and remembers it).
 * If saving isn't possible, the system share sheet opens instead
 * ("Save to Drive", "Open with…").
 */

function fileNameFor(title: string): string {
  const clean = title
    .replace(/[\\/:*?"<>|#%{}^~[\]`]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);
  return (clean || 'ملف') + '.pdf';
}

export type SaveResult = 'saved' | 'shared' | 'cancelled';

export async function saveToPhone(localUri: string, title: string): Promise<SaveResult> {
  const src = new File(localUri);
  let dirUri = getState().settings.saveDirUri;

  for (let attempt = 0; attempt < 2; attempt++) {
    if (!dirUri) {
      try {
        const picked = await Directory.pickDirectoryAsync();
        dirUri = picked.uri;
        actions.setSettings({ saveDirUri: dirUri });
      } catch {
        return 'cancelled'; // the student closed the folder picker
      }
    }
    try {
      const dir = new Directory(dirUri);
      const out = dir.createFile(fileNameFor(title), 'application/pdf');
      out.write(await src.bytes());
      return 'saved';
    } catch {
      // The remembered folder is gone or no longer writable: ask once more.
      dirUri = null;
      actions.setSettings({ saveDirUri: null });
    }
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(localUri, { mimeType: 'application/pdf', dialogTitle: title, UTI: 'com.adobe.pdf' });
    return 'shared';
  }
  return 'cancelled';
}

export async function openWith(localUri: string, title: string) {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(localUri, { mimeType: 'application/pdf', dialogTitle: title, UTI: 'com.adobe.pdf' });
  }
}
