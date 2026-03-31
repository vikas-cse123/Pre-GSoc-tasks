/**
 * MediaPreviewList.jsx
 * src/components/Tutorials/NewTutorial/MediaPreviewList.jsx
 *
 * TASK 3 — Media Upload Support
 *
 * Shows a preview of files selected for upload before they are submitted.
 * - Images: renders an object URL thumbnail
 * - PDFs:   renders a PDF icon with filename
 *
 * Props:
 *   files    {File[]}               - array of File objects
 *   onRemove {(index: number) => void} - callback to remove a file from selection
 */

import React, { useEffect, useState } from "react";

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";

import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import CloseIcon from "@mui/icons-material/Close";
import ImageIcon from "@mui/icons-material/Image";

// ─── single preview item ──────────────────────────────────────────────────────
const PreviewItem = ({ file, index, onRemove }) => {
  const [objectUrl, setObjectUrl] = useState(null);
  const isImage = file.type.startsWith("image/");
  const isPdf   = file.type === "application/pdf";

  useEffect(() => {
    if (isImage) {
      const url = URL.createObjectURL(file);
      setObjectUrl(url);
      // Revoke on unmount to avoid memory leaks
      return () => URL.revokeObjectURL(url);
    }
  }, [file, isImage]);

  const sizeLabel = file.size < 1024 * 1024
    ? `${(file.size / 1024).toFixed(0)} KB`
    : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        p: 1,
        border: "1px solid",
        borderColor: "grey.200",
        borderRadius: 1.5,
        bgcolor: "grey.50",
        position: "relative",
      }}
    >
      {/* Thumbnail or icon */}
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: 1,
          overflow: "hidden",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: isImage ? "transparent" : "error.50",
        }}
      >
        {isImage && objectUrl ? (
          <Box
            component="img"
            src={objectUrl}
            alt={file.name}
            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : isPdf ? (
          <PictureAsPdfIcon sx={{ color: "error.main", fontSize: 28 }} />
        ) : (
          <ImageIcon sx={{ color: "grey.400", fontSize: 28 }} />
        )}
      </Box>

      {/* Filename + size */}
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Tooltip title={file.name}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {file.name}
          </Typography>
        </Tooltip>
        <Typography variant="caption" color="text.secondary">
          {sizeLabel} · {isImage ? "Image" : "PDF"}
        </Typography>
      </Box>

      {/* Remove button */}
      <Tooltip title="Remove">
        <IconButton
          size="small"
          onClick={() => onRemove(index)}
          aria-label={`Remove ${file.name}`}
          sx={{ color: "grey.500", "&:hover": { color: "error.main" } }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

// ─── list ─────────────────────────────────────────────────────────────────────
const MediaPreviewList = ({ files, onRemove }) => {
  if (!files || files.length === 0) return null;

  return (
    <Box sx={{ mt: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        Selected files ({files.length})
      </Typography>
      {files.map((file, index) => (
        <PreviewItem
          key={`${file.name}-${index}`}
          file={file}
          index={index}
          onRemove={onRemove}
        />
      ))}
    </Box>
  );
};

export default MediaPreviewList;
