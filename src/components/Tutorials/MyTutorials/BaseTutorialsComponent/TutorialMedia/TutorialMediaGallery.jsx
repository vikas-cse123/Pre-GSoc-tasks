/**
 * TutorialMediaGallery.jsx
 * src/components/Tutorials/TutorialMediaGallery.jsx
 *
 * TASK 3 — Media Upload Support
 *
 * Renders the mediaItems array stored on a tutorial document.
 * Handles rendering for:
 *   - Images (jpg, png, gif): shown as a responsive image grid with
 *     click-to-expand lightbox (using MUI Dialog).
 *   - PDFs: shown as a card with a PDF icon, filename, and an
 *     "Open PDF" button that opens the file in a new tab.
 *
 * Also supports delete (for editors) via the deleteTutorialMedia action.
 *
 * PROPS:
 *   mediaItems   {array}   - from tutorial Redux state (tutorial.mediaItems)
 *   owner        {string}  - tutorial owner
 *   tutorial_id  {string}
 *   canDelete    {boolean} - show delete buttons (true for tutorial editors)
 */

import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useFirebase, useFirestore } from "react-redux-firebase";

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardMedia from "@mui/material/CardMedia";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";

import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CloseIcon from "@mui/icons-material/Close";
import ZoomInIcon from "@mui/icons-material/ZoomIn";

import { deleteTutorialMedia } from "../../store/actions/mediaActions";

// ─── image card ───────────────────────────────────────────────────────────────
const ImageCard = ({ item, canDelete, onDelete, onExpand }) => (
  <Card
    sx={{
      borderRadius: 2,
      border: "1px solid",
      borderColor: "grey.200",
      overflow: "hidden",
      transition: "box-shadow 0.2s",
      "&:hover": { boxShadow: "0 4px 16px rgba(0,0,0,0.10)" },
    }}
  >
    <Box sx={{ position: "relative" }}>
      <CardMedia
        component="img"
        height="160"
        image={item.thumbnail || item.url}
        alt={item.name}
        sx={{ objectFit: "cover", cursor: "zoom-in" }}
        onClick={() => onExpand(item)}
      />
      {/* Expand icon overlay */}
      <IconButton
        size="small"
        onClick={() => onExpand(item)}
        aria-label="Expand image"
        sx={{
          position: "absolute",
          bottom: 6,
          right: 6,
          bgcolor: "rgba(0,0,0,0.45)",
          color: "#fff",
          "&:hover": { bgcolor: "rgba(0,0,0,0.65)" },
        }}
      >
        <ZoomInIcon fontSize="small" />
      </IconButton>
    </Box>

    <CardContent sx={{ py: 1, px: 1.5, "&:last-child": { pb: 1 } }}>
      <Tooltip title={item.name}>
        <Typography
          variant="caption"
          sx={{
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: "text.secondary",
          }}
        >
          {item.name}
        </Typography>
      </Tooltip>
    </CardContent>

    {canDelete && (
      <CardActions sx={{ pt: 0, px: 1.5, pb: 1 }}>
        <Tooltip title="Delete image">
          <IconButton
            size="small"
            color="error"
            onClick={() => onDelete(item)}
            aria-label={`Delete ${item.name}`}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </CardActions>
    )}
  </Card>
);

// ─── pdf card ─────────────────────────────────────────────────────────────────
const PdfCard = ({ item, canDelete, onDelete }) => (
  <Card
    sx={{
      borderRadius: 2,
      border: "1px solid",
      borderColor: "grey.200",
      display: "flex",
      flexDirection: "column",
      transition: "box-shadow 0.2s",
      "&:hover": { boxShadow: "0 4px 16px rgba(0,0,0,0.10)" },
    }}
  >
    <Box
      sx={{
        bgcolor: "error.50",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 100,
      }}
    >
      <PictureAsPdfIcon sx={{ fontSize: 52, color: "error.main" }} />
    </Box>

    <CardContent sx={{ py: 1, px: 1.5, flexGrow: 1 }}>
      <Tooltip title={item.name}>
        <Typography
          variant="caption"
          sx={{
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: "text.secondary",
            mb: 0.5,
          }}
        >
          {item.name}
        </Typography>
      </Tooltip>
      <Chip
        label="PDF"
        size="small"
        sx={{ fontSize: "0.65rem", height: 18, bgcolor: "error.100", color: "error.800" }}
      />
    </CardContent>

    <CardActions sx={{ pt: 0, px: 1.5, pb: 1, gap: 0.5 }}>
      <Button
        size="small"
        variant="outlined"
        endIcon={<OpenInNewIcon />}
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open PDF: ${item.name}`}
        sx={{ textTransform: "none", fontSize: "0.72rem", borderRadius: "12px" }}
      >
        Open
      </Button>

      {canDelete && (
        <Tooltip title="Delete PDF">
          <IconButton
            size="small"
            color="error"
            onClick={() => onDelete(item)}
            aria-label={`Delete ${item.name}`}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </CardActions>
  </Card>
);

// ─── main gallery ─────────────────────────────────────────────────────────────
const TutorialMediaGallery = ({
  mediaItems = [],
  owner,
  tutorial_id,
  canDelete = false,
}) => {
  const firebase  = useFirebase();
  const firestore = useFirestore();
  const dispatch  = useDispatch();

  const [lightboxItem, setLightboxItem] = useState(null);

  if (!mediaItems || mediaItems.length === 0) return null;

  const images    = mediaItems.filter((m) => m.type === "image");
  const documents = mediaItems.filter((m) => m.type === "document");

  const handleDelete = (item) => {
    deleteTutorialMedia(owner, tutorial_id, item)(firebase, firestore, dispatch);
  };

  return (
    <Box sx={{ mt: 3 }}>
      <Divider sx={{ mb: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          MEDIA ({mediaItems.length})
        </Typography>
      </Divider>

      {/* ── Images ── */}
      {images.length > 0 && (
        <>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Images
          </Typography>
          <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
            {images.map((item) => (
              <Grid item key={item.id} xs={6} sm={4} md={3} lg={2}>
                <ImageCard
                  item={item}
                  canDelete={canDelete}
                  onDelete={handleDelete}
                  onExpand={setLightboxItem}
                />
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {/* ── PDFs ── */}
      {documents.length > 0 && (
        <>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Documents
          </Typography>
          <Grid container spacing={1.5}>
            {documents.map((item) => (
              <Grid item key={item.id} xs={6} sm={4} md={3} lg={2}>
                <PdfCard
                  item={item}
                  canDelete={canDelete}
                  onDelete={handleDelete}
                />
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {/* ── Image lightbox ── */}
      <Dialog
        open={Boolean(lightboxItem)}
        onClose={() => setLightboxItem(null)}
        maxWidth="lg"
        PaperProps={{ sx: { bgcolor: "transparent", boxShadow: "none" } }}
      >
        <DialogContent
          sx={{
            p: 0,
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconButton
            onClick={() => setLightboxItem(null)}
            aria-label="Close image"
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              bgcolor: "rgba(0,0,0,0.5)",
              color: "#fff",
              zIndex: 1,
              "&:hover": { bgcolor: "rgba(0,0,0,0.75)" },
            }}
          >
            <CloseIcon />
          </IconButton>

          {lightboxItem && (
            <Box
              component="img"
              src={lightboxItem.url}
              alt={lightboxItem.name}
              sx={{
                maxWidth: "90vw",
                maxHeight: "85vh",
                objectFit: "contain",
                borderRadius: 1,
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default TutorialMediaGallery;
