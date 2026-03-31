/**
 * mediaActions.js
 * src/store/actions/mediaActions.js
 *
 * TASK 3 — Media Upload Support
 *
 * Handles uploading, storing metadata, and deleting tutorial media
 * (images: jpg/png/gif, documents: pdf).
 *
 * DATA MODEL EXTENSION:
 * Each tutorial document in Firestore already has an imageURLs array.
 * We extend this with a richer mediaItems array that stores full metadata:
 *
 *   mediaItems: [
 *     {
 *       id:        string,        // uuid — used as the storage filename
 *       name:      string,        // original filename from user's device
 *       url:       string,        // Firebase Storage download URL
 *       type:      "image" | "document",
 *       mimeType:  string,        // e.g. "image/png", "application/pdf"
 *       size:      number,        // bytes
 *       thumbnail: string | null, // download URL of generated thumb (images only)
 *       uploadedAt: Timestamp,
 *       uploadedBy: string,       // uid
 *     }
 *   ]
 *
 * ACCEPTED FILE TYPES:
 *   Images:    image/jpeg, image/png, image/gif
 *   Documents: application/pdf
 *
 * MAX FILE SIZE: 10 MB per file
 *
 * STORAGE PATH:
 *   tutorials/{type}/{owner}/{tutorial_id}/media/{id}_{filename}
 */

import * as actions from "./actionTypes";
import { getCurrentTutorialData } from "./tutorialsActions";
import { checkUserOrOrgHandle } from "./tutorialsActions";
import { v4 as uuidv4 } from "uuid";

// ─── constants ────────────────────────────────────────────────────────────────
export const ACCEPTED_TYPES = {
  image: ["image/jpeg", "image/png", "image/gif"],
  document: ["application/pdf"],
};

export const ALL_ACCEPTED_TYPES = [
  ...ACCEPTED_TYPES.image,
  ...ACCEPTED_TYPES.document,
];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Derives the media type string from a MIME type.
 * @param {string} mimeType
 * @returns {"image" | "document" | "unknown"}
 */
export const getMediaType = (mimeType) => {
  if (ACCEPTED_TYPES.image.includes(mimeType)) return "image";
  if (ACCEPTED_TYPES.document.includes(mimeType)) return "document";
  return "unknown";
};

/**
 * Validates a File object before upload.
 * Returns null on success, or an error message string on failure.
 * @param {File} file
 * @returns {string | null}
 */
export const validateMediaFile = (file) => {
  if (!ALL_ACCEPTED_TYPES.includes(file.type)) {
    return `Unsupported file type: ${file.type}. Accepted: JPEG, PNG, GIF, PDF.`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum is 10 MB.`;
  }
  return null;
};

// ─── action: uploadTutorialMedia ─────────────────────────────────────────────

/**
 * Uploads one or more media files (images / PDFs) for a tutorial.
 * Writes metadata to the tutorial's mediaItems array in Firestore.
 *
 * @param {string}   owner        - org handle or user handle
 * @param {string}   tutorial_id
 * @param {File[]}   files        - array of File objects from the file picker
 * @param {string}   uploadedBy   - current user's uid
 */
export const uploadTutorialMedia =
  (owner, tutorial_id, files, uploadedBy) =>
  async (firebase, firestore, dispatch) => {
    // Validate all files before starting any upload
    for (const file of files) {
      const error = validateMediaFile(file);
      if (error) {
        dispatch({
          type: actions.TUTORIAL_MEDIA_UPLOAD_FAIL,
          payload: error,
        });
        return;
      }
    }

    try {
      dispatch({ type: actions.TUTORIAL_MEDIA_UPLOAD_START });

      const type = await checkUserOrOrgHandle(owner)(firebase, firestore);
      const storagePath = `tutorials/${type}/${owner}/${tutorial_id}/media`;

      const uploadedItems = await Promise.all(
        files.map(async (file) => {
          const id = uuidv4();
          const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const fullPath = `${storagePath}/${id}_${safeFilename}`;

          // Upload file to Firebase Storage
          const storageRef = firebase.storage().ref(fullPath);
          const snapshot = await storageRef.put(file);
          const downloadURL = await snapshot.ref.getDownloadURL();

          const mediaType = getMediaType(file.type);

          // Build the metadata object
          const mediaItem = {
            id,
            name: file.name,
            url: downloadURL,
            type: mediaType,
            mimeType: file.type,
            size: file.size,
            thumbnail: mediaType === "image" ? downloadURL : null,
            uploadedAt: firestore.FieldValue.serverTimestamp(),
            uploadedBy,
          };

          return mediaItem;
        })
      );

      // Append all new items to the mediaItems array on the tutorial document
      await firestore
        .collection("tutorials")
        .doc(tutorial_id)
        .update({
          mediaItems: firestore.FieldValue.arrayUnion(...uploadedItems),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });

      // Refresh tutorial data in Redux store
      await getCurrentTutorialData(
        owner,
        tutorial_id
      )(firebase, firestore, dispatch);

      dispatch({ type: actions.TUTORIAL_MEDIA_UPLOAD_SUCCESS });
    } catch (e) {
      console.error("TUTORIAL_MEDIA_UPLOAD_FAIL", e);
      dispatch({
        type: actions.TUTORIAL_MEDIA_UPLOAD_FAIL,
        payload: e.message,
      });
    }
  };

// ─── action: deleteTutorialMedia ─────────────────────────────────────────────

/**
 * Deletes a single media item from Firebase Storage and removes its
 * metadata from the tutorial's mediaItems array in Firestore.
 *
 * @param {string} owner
 * @param {string} tutorial_id
 * @param {object} mediaItem   - the full mediaItem object (id, name, url, type, …)
 */
export const deleteTutorialMedia =
  (owner, tutorial_id, mediaItem) =>
  async (firebase, firestore, dispatch) => {
    try {
      dispatch({ type: actions.TUTORIAL_MEDIA_DELETE_START });

      const type = await checkUserOrOrgHandle(owner)(firebase, firestore);
      const safeFilename = mediaItem.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `tutorials/${type}/${owner}/${tutorial_id}/media/${mediaItem.id}_${safeFilename}`;

      // Delete from Storage
      const storageRef = firebase.storage().ref(storagePath);
      await storageRef.delete();

      // Remove metadata from Firestore array
      // We reconstruct a plain object without Timestamp for arrayRemove to match
      const itemToRemove = {
        id:          mediaItem.id,
        name:        mediaItem.name,
        url:         mediaItem.url,
        type:        mediaItem.type,
        mimeType:    mediaItem.mimeType,
        size:        mediaItem.size,
        thumbnail:   mediaItem.thumbnail,
        uploadedBy:  mediaItem.uploadedBy,
      };

      await firestore
        .collection("tutorials")
        .doc(tutorial_id)
        .update({
          mediaItems: firebase.firestore.FieldValue.arrayRemove(itemToRemove),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });

      await getCurrentTutorialData(
        owner,
        tutorial_id
      )(firebase, firestore, dispatch);

      dispatch({ type: actions.TUTORIAL_MEDIA_DELETE_SUCCESS });
    } catch (e) {
      console.error("TUTORIAL_MEDIA_DELETE_FAIL", e);
      dispatch({
        type: actions.TUTORIAL_MEDIA_DELETE_FAIL,
        payload: e.message,
      });
    }
  };

// ─── action: clearMediaUploadState ───────────────────────────────────────────

export const clearMediaUploadState = () => (dispatch) =>
  dispatch({ type: actions.CLEAR_TUTORIAL_MEDIA_STATE });