

import React, { useState } from "react";
import { Link } from "react-router-dom";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import CardActions from "@mui/material/CardActions";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Tooltip from "@mui/material/Tooltip";

import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import EditNoteIcon from "@mui/icons-material/EditNote";

import TutorialImg from "../../../../assets/images/tutorialCard.png";

const MAX_VISIBLE_TAGS = 3;

const TutorialCard = ({
  tutorialData: {
    tutorial_id,
    title = "Untitled Tutorial",
    summary = "",
    icon,
    owner,
    tut_tags = [],
    isPublished = false,
  },
  loading = false,
}) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const visibleTags = tut_tags.slice(0, MAX_VISIBLE_TAGS);
  const extraTagCount = tut_tags.length - MAX_VISIBLE_TAGS;
  const imageSrc = !imgError && icon ? icon : TutorialImg;

  // ─── loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <Card
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          borderRadius: 2,
        }}
      >
        <Skeleton variant="rectangular" height={160} />
        <CardContent sx={{ flexGrow: 1 }}>
          <Skeleton variant="text" width="80%" height={28} sx={{ mb: 1 }} />
          <Skeleton variant="text" width="100%" />
          <Skeleton variant="text" width="90%" />
          <Skeleton variant="text" width="60%" />
        </CardContent>
        <Box sx={{ px: 2, pb: 2 }}>
          <Skeleton variant="rectangular" width={80} height={32} sx={{ borderRadius: 4 }} />
        </Box>
      </Card>
    );
  }

  // ─── rendered card ──────────────────────────────────────────────────────────
  return (
    <Card
      data-testId="tutorialCard"
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: 2,
        border: "1px solid",
        borderColor: "grey.200",
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        },
      }}
    >
      {/* ── Thumbnail + status badge ── */}
      <Box sx={{ position: "relative" }}>
        {/* Show skeleton behind image until it loads */}
        {!imgLoaded && (
          <Skeleton
            variant="rectangular"
            width="100%"
            height={160}
            sx={{ position: "absolute", top: 0, left: 0 }}
          />
        )}
        <CardMedia
          component="img"
          height="160"
          image={imageSrc}
          alt={`${title} thumbnail`}
          onLoad={() => setImgLoaded(true)}
          onError={() => {
            setImgError(true);
            setImgLoaded(true);
          }}
          sx={{
            objectFit: "cover",
            opacity: imgLoaded ? 1 : 0,
            transition: "opacity 0.3s ease",
          }}
        />

        {/* Published / Draft chip overlaid on image */}
        <Chip
          icon={
            isPublished ? (
              <CheckCircleOutlineIcon sx={{ fontSize: 14 }} />
            ) : (
              <EditNoteIcon sx={{ fontSize: 14 }} />
            )
          }
          label={isPublished ? "Published" : "Draft"}
          size="small"
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            fontSize: "0.7rem",
            fontWeight: 600,
            bgcolor: isPublished
              ? "rgba(6, 95, 70, 0.88)"
              : "rgba(107, 114, 128, 0.88)",
            color: "#fff",
            backdropFilter: "blur(4px)",
            "& .MuiChip-icon": { color: "#fff" },
          }}
        />
      </Box>

      {/* ── Content ── */}
      <CardActionArea
        component={Link}
        to={`/tutorials/${owner}/${tutorial_id}`}
        aria-label={`View tutorial: ${title}`}
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "flex-start",
          // Keyboard focus ring
          "&:focus-visible": {
            outline: "2px solid",
            outlineColor: "primary.main",
            outlineOffset: "-2px",
          },
        }}
      >
        <CardContent sx={{ width: "100%", pb: 1 }}>
          {/* Title — clamped to 2 lines */}
          <Tooltip title={title} placement="top" disableHoverListener={title.length < 50}>
            <Typography
              gutterBottom
              variant="h6"
              component="h2"
              sx={{
                fontWeight: 600,
                fontSize: { xs: "0.95rem", sm: "1rem", md: "1.05rem" },
                lineHeight: 1.35,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                mb: 0.75,
              }}
            >
              {title}
            </Typography>
          </Tooltip>

          {/* Summary — clamped to 3 lines */}
          {summary && (
            <Typography
              variant="body2"
              color="text.secondary"
              component="p"
              sx={{
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                lineHeight: 1.5,
                fontSize: { xs: "0.8rem", sm: "0.825rem" },
                mb: 1,
              }}
            >
              {summary}
            </Typography>
          )}

          {/* Owner handle */}
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ fontSize: "0.7rem" }}
          >
            by @{owner}
          </Typography>

          {/* Tags */}
          {visibleTags.length > 0 && (
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 0.5,
                mt: 1.25,
              }}
            >
              {visibleTags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  sx={{
                    fontSize: "0.68rem",
                    height: 20,
                    bgcolor: "primary.50",
                    color: "primary.700",
                    border: "1px solid",
                    borderColor: "primary.200",
                  }}
                />
              ))}
              {extraTagCount > 0 && (
                <Chip
                  label={`+${extraTagCount}`}
                  size="small"
                  sx={{
                    fontSize: "0.68rem",
                    height: 20,
                    bgcolor: "grey.100",
                    color: "text.secondary",
                  }}
                />
              )}
            </Box>
          )}
        </CardContent>
      </CardActionArea>

      {/* ── Action bar ── */}
      <CardActions
        sx={{
          px: 2,
          pb: 2,
          pt: 0,
          justifyContent: "flex-end",
          borderTop: "1px solid",
          borderColor: "grey.100",
          mt: "auto",
        }}
      >
        <Button
          component={Link}
          to={`/tutorials/${owner}/${tutorial_id}`}
          size="small"
          variant="contained"
          disableElevation
          aria-label={`View tutorial: ${title}`}
          sx={{
            borderRadius: "20px",
            textTransform: "none",
            fontWeight: 600,
            fontSize: "0.8rem",
            px: 2.5,
            py: 0.6,
            bgcolor: "primary.main",
            "&:hover": {
              bgcolor: "primary.dark",
            },
          }}
        >
          View Tutorial
        </Button>
      </CardActions>
    </Card>
  );
};

export default TutorialCard;