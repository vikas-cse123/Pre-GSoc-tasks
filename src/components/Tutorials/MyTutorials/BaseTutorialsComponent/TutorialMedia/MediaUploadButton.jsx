/**
 * MediaUploadButton.jsx
 * src/components/Tutorials/NewTutorial/MediaUploadButton.jsx
 *
 * TASK 3 — Media Upload Support
 *
 * A drag-and-drop + click-to-browse upload zone for tutorial media.
 * Accepts: JPEG, PNG, GIF, PDF — max 10 MB per file.
 *
 * Used inside NewTutorial/index.jsx and also inside the tutorial
 * editor page after a tutorial has been created (owner + tutorial_id known).
 *
 * PROPS:
 *   owner        {string}   - tutorial owner handle
 *   tutorial_id  {string}   - tutorial document ID
 *   uploadedBy   {string}   - current user uid
 *   onSuccess    {function} - called after successful upload
 *   disabled     {boolean}  - disables the zone (e.g. during creation)
 */

import React, { useCallback, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useFirebase, useFirestore } from "react-redux-firebase";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import ImageIcon from "@mui/icons-material/Image";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";

import {
  uploadTutorialMedia,
  validateMediaFile,
  ALL_ACCEPTED_TYPES,
  clearMediaUploadState,
} from "../../../store/actions/mediaActions";

import MediaPreviewList from "./MediaPreviewList";

// ─── component ────────────────────────────────────────────────────────────────
const MediaUploadButton = ({
  owner,
  tutorial_id,
  uploadedBy,
  onSuccess,
  disabled = false,
}) => {
  const firebase  = useFirebase();
  const firestore = useFirestore();
  const dispatch  = useDispatch();
  const fileInput = useRef(null);

  const [dragOver,       setDragOver]       = useState(false);
  const [localError,     setLocalError]     = useState(null);
  const [selectedFiles,  setSelectedFiles]  = useState([]);

  const uploading = useSelector(
    ({ tutorials: { media: { loading } } }) => loading
  );
  const uploadError = useSelector(
    ({ tutorials: { media: { error } } }) => error
  );

  // ─── file validation + preview ────────────────────────────────────────────
  const handleFiles = useCallback((files) => {
    setLocalError(null);
    dispatch(clearMediaUploadState());

    const fileArray = Array.from(files);
    const errors = fileArray
      .map((f) => validateMediaFile(f))
      .filter(Boolean);

    if (errors.length > 0) {
      setLocalError(errors[0]); // show the first error
      return;
    }

    setSelectedFiles(fileArray);
  }, [dispatch]);

  // ─── drag handlers ────────────────────────────────────────────────────────
  const onDragOver  = (e) => { e.preventDefault(); setDragOver(true);  };
  const onDragLeave = (e) => { e.preventDefault(); setDragOver(false); };
  const onDrop      = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  // ─── click-to-browse ──────────────────────────────────────────────────────
  const onFileChange = (e) => handleFiles(e.target.files);

  // ─── submit upload ────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!selectedFiles.length || !owner || !tutorial_id) return;

    await uploadTutorialMedia(
      owner,
      tutorial_id,
      selectedFiles,
      uploadedBy
    )(firebase, firestore, dispatch);

    setSelectedFiles([]);
    if (onSuccess) onSuccess();
  };

  const handleRemoveSelected = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <Box sx={{ mt: 2 }}>
      {/* Drop zone */}
      <Box
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !disabled && fileInput.current?.click()}
        sx={{
          border: "2px dashed",
          borderColor: dragOver ? "primary.main" : "grey.300",
          borderRadius: 2,
          p: 3,
          textAlign: "center",
          cursor: disabled ? "not-allowed" : "pointer",
          bgcolor: dragOver ? "primary.50" : "grey.50",
          transition: "all 0.2s ease",
          "&:hover": disabled
            ? {}
            : { borderColor: "primary.main", bgcolor: "primary.50" },
        }}
      >
        <CloudUploadIcon
          sx={{ fontSize: 40, color: dragOver ? "primary.main" : "grey.400", mb: 1 }}
        />

        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          {disabled
            ? "Save the tutorial first to upload media"
            : "Drag & drop files here, or click to browse"}
        </Typography>

        <Typography variant="caption" color="text.disabled">
          Accepted: JPEG, PNG, GIF, PDF — max 10 MB each
        </Typography>

        {/* Type icons */}
        <Box sx={{ display: "flex", justifyContent: "center", gap: 1, mt: 1.5 }}>
          <Tooltip title="Images (JPEG, PNG, GIF)">
            <ImageIcon sx={{ color: "grey.400", fontSize: 20 }} />
          </Tooltip>
          <Tooltip title="Documents (PDF)">
            <PictureAsPdfIcon sx={{ color: "grey.400", fontSize: 20 }} />
          </Tooltip>
        </Box>
      </Box>

      {/* Hidden file input */}
      <input
        ref={fileInput}
        type="file"
        multiple
        accept={ALL_ACCEPTED_TYPES.join(",")}
        style={{ display: "none" }}
        onChange={onFileChange}
        aria-label="Upload media files"
      />

      {/* Validation error */}
      {(localError || uploadError) && (
        <Alert
          severity="error"
          sx={{ mt: 1.5 }}
          onClose={() => {
            setLocalError(null);
            dispatch(clearMediaUploadState());
          }}
        >
          {localError || uploadError}
        </Alert>
      )}

      {/* Selected file preview list */}
      {selectedFiles.length > 0 && (
        <MediaPreviewList
          files={selectedFiles}
          onRemove={handleRemoveSelected}
        />
      )}

      {/* Upload progress bar */}
      {uploading && (
        <Box sx={{ mt: 1.5 }}>
          <LinearProgress />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            Uploading…
          </Typography>
        </Box>
      )}

      {/* Upload button — only shown when files are selected and tutorial exists */}
      {selectedFiles.length > 0 && tutorial_id && !disabled && (
        <Button
          variant="contained"
          size="small"
          disabled={uploading}
          onClick={handleUpload}
          startIcon={<CloudUploadIcon />}
          sx={{ mt: 1.5, borderRadius: "20px", textTransform: "none" }}
        >
          {uploading ? "Uploading…" : `Upload ${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""}`}
        </Button>
      )}
    </Box>
  );
};

export default MediaUploadButton;
