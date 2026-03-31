/**
 * NewTutorial/index.jsx  — UPDATED for Task 3
 * src/components/Tutorials/NewTutorial/index.jsx
 *
 * TASK 3 — Media Upload Support
 *
 * CHANGES FROM ORIGINAL:
 *  1. Replaced the three bare IconButtons (ImageIcon, MovieIcon, DescriptionIcon)
 *     that had no functionality with the new MediaUploadButton component.
 *  2. MediaUploadButton is disabled during tutorial creation (no tutorial_id yet).
 *     After the tutorial is created and the user is redirected to the editor,
 *     MediaUploadButton in the editor page will have the tutorial_id available.
 *  3. All original functionality (title, summary, owner, tags, submit) unchanged.
 *  4. makeStyles replaced with sx prop (MUI v5 cleanup, no @mui/styles import).
 *  5. MovieIcon removed — video not in scope per task requirements.
 */

import React, { useEffect, useState } from "react";
import { AppstoreAddOutlined } from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { createTutorial, getProfileData } from "../../../store/actions";
import { useFirebase, useFirestore } from "react-redux-firebase";
import { useHistory } from "react-router-dom";

import Button from "@mui/material/Button";
import { Alert, Box, Chip } from "@mui/material";
import TextField from "@mui/material/TextField";
import Modal from "@mui/material/Modal";
import { Typography } from "@mui/material";
import Select from "react-select";
import { common } from "@mui/material/colors";
import CloseIcon from "@mui/icons-material/Close";

import MediaUploadButton from "./MediaUploadButton";

const NewTutorial = ({ viewModal, onSidebarClick, viewCallback, active }) => {
  const firebase  = useFirebase();
  const firestore = useFirestore();
  const dispatch  = useDispatch();
  const history   = useHistory();

  const [visible,   setVisible]   = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(false);
  const [tags,      setTags]      = useState([]);
  const [newTag,    setNewTag]    = useState("");
  const [formValue, setformValue] = useState({
    title: "",
    summary: "",
    owner: "",
    tags: [],
  });

  const loadingProp = useSelector(
    ({ tutorials: { create: { loading } } }) => loading
  );
  const errorProp = useSelector(
    ({ tutorials: { create: { error } } }) => error
  );
  const currentUser = useSelector(({ firebase: { auth } }) => auth);
  const profileState = useSelector((state) => state.profile.data);
  const { organizations, isEmpty } = profileState || { organizations: null, isEmpty: false };

  const displayName = useSelector(
    ({ firebase: { profile: { displayName } } }) => displayName
  );
  const userHandle = useSelector(
    ({ firebase: { profile: { handle } } }) => handle
  );

  useEffect(() => { setLoading(loadingProp); }, [loadingProp]);
  useEffect(() => { setError(errorProp);     }, [errorProp]);
  useEffect(() => {
    setformValue((prev) => ({ ...prev, tags }));
  }, [tags]);

  useEffect(() => {
    if (organizations === null && !isEmpty) {
      getProfileData()(firebase, firestore, dispatch);
    }
  }, [firestore, firebase, dispatch, organizations, isEmpty]);

  useEffect(() => {
    setTags([]);
    setNewTag("");
    setformValue({ title: "", summary: "", owner: "", tags: [] });
    setVisible(viewModal);
  }, [viewModal]);

  const onSubmit = (formData) => {
    formData.preventDefault();
    const tutorialData = {
      ...formValue,
      created_by: userHandle,
      is_org: userHandle !== formValue.owner,
      completed: false,
    };
    createTutorial(tutorialData)(firebase, firestore, dispatch, history);
  };

  const onOwnerChange = (value) =>
    setformValue((prev) => ({ ...prev, owner: value }));

  const handleChange = (e) => {
    const { name, value } = e.target;
    setformValue((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddTag = () => {
    if (newTag.trim() !== "") {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const handleDeleteTag = (tagToDelete) =>
    setTags(tags.filter((tag) => tag !== tagToDelete));

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleClose = () => {
    onSidebarClick();
    setTags([]);
    setNewTag("");
    setformValue({ title: "", summary: "", owner: "", tags: [] });
  };

  return (
    <Modal
      open={visible}
      onClose={onSidebarClick}
      aria-labelledby="new-tutorial-modal-title"
      aria-describedby="new-tutorial-modal-description"
      sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <Box
        data-testId="tutorialNewModal"
        sx={{
          bgcolor: "background.paper",
          borderRadius: 2,
          p: 3,
          pt: 2,
          // Responsive width: full on mobile, fixed on desktop
          width: { xs: "95vw", sm: "80vw", md: "560px" },
          maxHeight: "90vh",
          overflowY: "auto",
          outline: "none",
        }}
      >
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} closable="true">
            Tutorial Creation Failed. Please try again.
          </Alert>
        )}

        <Typography
          variant="h5"
          id="new-tutorial-modal-title"
          sx={{ mb: 2 }}
        >
          Create a Tutorial
        </Typography>

        {/* Owner selector */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            Create as
          </Typography>
          <Select
            options={organizations?.map((org) => ({
              value: org.org_handle,
              label: org.org_name,
            }))}
            onChange={(data) => onOwnerChange(data.value)}
            id="orgSelect"
            placeholder="Select organization…"
          />
        </Box>

        <form id="tutorialNewForm">
          {/* Title */}
          <TextField
            placeholder="Title of the Tutorial"
            autoComplete="title"
            name="title"
            variant="outlined"
            fullWidth
            data-testId="newTutorial_title"
            id="newTutorialTitle"
            sx={{ mb: 2 }}
            onChange={handleChange}
            inputProps={{ "aria-label": "Tutorial title" }}
          />

          {/* Summary */}
          <TextField
            fullWidth
            variant="outlined"
            name="summary"
            placeholder="Summary of the Tutorial"
            autoComplete="summary"
            id="newTutorialSummary"
            data-testId="newTutorial_summary"
            onChange={handleChange}
            sx={{ mb: 2 }}
            inputProps={{ "aria-label": "Tutorial summary" }}
          />

          {/* Tags */}
          <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
            <TextField
              label="Add a tag"
              variant="outlined"
              size="small"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleKeyDown}
              sx={{ flex: 1 }}
              inputProps={{ "aria-label": "Add tag" }}
            />
            <Button
              variant="contained"
              size="small"
              onClick={handleAddTag}
              sx={{ borderRadius: "20px", textTransform: "none" }}
            >
              Add Tag
            </Button>
          </Box>

          {/* Tag chips */}
          {tags.length > 0 && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 2 }}>
              {tags.map((tag, index) => (
                <Chip
                  key={index}
                  label={tag}
                  size="small"
                  onDelete={() => handleDeleteTag(tag)}
                  deleteIcon={<CloseIcon />}
                />
              ))}
            </Box>
          )}

          {/* ── Media Upload ──────────────────────────────────────────────── */}
          {/* tutorial_id is not yet available at creation time.             */}
          {/* MediaUploadButton is shown in disabled state here to inform    */}
          {/* the user that media can be added after the tutorial is created.*/}
          <MediaUploadButton
            owner={formValue.owner || undefined}
            tutorial_id={undefined}   // not yet created
            uploadedBy={currentUser?.uid}
            disabled={true}           // enabled in the editor after creation
          />

          {/* Action buttons */}
          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 3 }}>
            <Button
              onClick={handleClose}
              id="cancelAddTutorial"
              sx={{ textTransform: "none" }}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              variant="contained"
              loading={loading}
              onClick={onSubmit}
              data-testid="newTutorialSubmit"
              disabled={
                formValue.title === "" ||
                formValue.summary === "" ||
                formValue.owner === ""
              }
              sx={{
                bgcolor: "#03AAFA",
                borderRadius: "30px",
                color: common.white,
                textTransform: "none",
                fontWeight: 600,
                "&:hover": { bgcolor: "#029de5" },
              }}
            >
              {loading ? "Creating…" : "Create"}
            </Button>
          </Box>
        </form>
      </Box>
    </Modal>
  );
};

export default NewTutorial;
