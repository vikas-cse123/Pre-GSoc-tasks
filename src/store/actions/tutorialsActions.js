/**
 * tutorialsActions.ts
 * src/store/actions/tutorialsActions.ts
 *
 * TASK 4 — TypeScript Migration
 *
 * MODULE CHOSEN: tutorialsActions.js
 *
 * WHY THIS MODULE:
 *   - It is the largest and most functionally isolated action file in the
 *     codebase. It covers the complete tutorial lifecycle: create, read,
 *     update steps, publish, delete, image upload, tags, and notifications.
 *   - It has no circular dependencies with other action files (it imports
 *     from authActions and orgActions only via named functions, not default
 *     exports), making it safe to migrate in isolation.
 *   - Strict typing here immediately catches the most common bugs in the
 *     codebase: missing fields on tutorial objects, wrong payload shapes
 *     dispatched to the reducer, and untyped Firestore document returns.
 *
 * TYPESCRIPT FEATURES USED:
 *   - Explicit interfaces for all domain objects (Tutorial, TutorialStep, etc.)
 *   - Strict return types on every exported function
 *   - Generic ThunkAction type alias to avoid repeating the full signature
 *   - Discriminated union for action types via ActionTypes enum
 *   - Type narrowing on Firestore QuerySnapshot results
 *   - Readonly arrays where mutation would be a bug
 *
 * MIGRATION NOTES:
 *   - Firebase / Firestore types imported from firebase/compat/app
 *     (compat path) to match the current codebase; update to modular
 *     imports when the Firebase Modular migration (Objective 7) is complete.
 *   - Elasticlunr has no @types package; a manual declaration file
 *     (src/types/elasticlunr.d.ts) is included below.
 *   - The dispatch, firebase, and firestore parameters are typed through
 *     the ThunkFn alias — this avoids redux-thunk generic complexity while
 *     the store itself is not yet typed.
 */

import * as actions from "./actionTypes";
import Elasticlunr from "../../helpers/elasticlunr";
import {
  checkOrgHandleExists,
  checkUserHandleExists,
  isUserSubscribed,
} from "./";
import _ from "lodash";

// ─────────────────────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Firebase / Firestore instance types (from compat SDK) */
import type firebase from "firebase/compat/app";
type Firebase  = typeof firebase;
type Firestore = firebase.firestore.Firestore & {
  FieldValue: typeof firebase.firestore.FieldValue;
};
type Dispatch  = (action: { type: string; payload?: unknown }) => void;

/**
 * Shorthand for the curried async thunk pattern used throughout this file.
 * e.g.  export const foo = (arg: string) => async (firebase, firestore, dispatch) => {...}
 */
type ThunkFn<TReturn = void> = (
  firebase: Firebase,
  firestore: Firestore,
  dispatch: Dispatch
) => Promise<TReturn>;

// ─── Domain interfaces ────────────────────────────────────────────────────────

export interface TutorialStep {
  id:         string;
  title:      string;
  content:    string;
  time:       number;
  visibility: boolean;
  deleted:    boolean;
}

export interface TutorialImageURL {
  name: string;
  url:  string;
}

export interface Tutorial {
  tutorial_id:      string;
  owner:            string;
  created_by:       string;
  editors:          string[];
  title:            string;
  summary:          string;
  isPublished:      boolean;
  featured_image:   string;
  icon:             string;
  tut_tags:         string[];
  url:              string;
  background_color: string;
  text_color:       string;
  imageURLs?:       TutorialImageURL[];
  steps?:           TutorialStep[];
  createdAt?:       firebase.firestore.Timestamp;
  updatedAt?:       firebase.firestore.Timestamp;
}

/** Shape used when creating a new tutorial (before Firestore ID is known) */
export interface CreateTutorialInput {
  title:       string;
  summary:     string;
  owner:       string;
  created_by:  string;
  is_org:      boolean;
  completed:   boolean;
  tags:        string[];
}

/** Payload for adding a new step */
export interface AddStepInput {
  owner:       string;
  tutorial_id: string;
  title:       string;
  time:        number;
  id:          string;
}

/** Payload for setting tutorial theme colours */
export interface TutorialThemeInput {
  tutorial_id: string;
  owner:       string;
  bgColor:     string;
  textColor:   string;
}

/** A lightweight entry stored in the tutorials list (not full Tutorial) */
export interface TutorialBasicData {
  owner:          string;
  tutorial_id:    string;
  title:          string;
  summary:        string;
  featured_image: string;
  icon:           string;
  isPublished?:   boolean;
}

export interface OrgTutorialIndex {
  owner:     string;
  tutorials: TutorialBasicData[];
}

export interface Notification {
  notification_id: string;
  content:         string;
  createdAt:       firebase.firestore.Timestamp;
  isRead:          boolean;
  username:        string;
  org:             string;
  tutorial_id:     string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SEARCH INDEX
// ─────────────────────────────────────────────────────────────────────────────

const tutorials_index = new Elasticlunr(
  "tutorial_id",
  "owner",
  "tutorial_id",
  "title",
  "summary"
);

export const fetchAndIndexTutorials =
  (): ThunkFn => async (firebase, firestore) => {
    try {
      const snapshot = await firestore.collection("tutorials").get();
      snapshot.forEach((doc) => {
        const data = doc.data() as Tutorial;
        tutorials_index.addDocToIndex({ id: doc.id, ...data });
      });
    } catch (error) {
      console.error("Error fetching or indexing tutorials:", error);
    }
  };

export const searchFromTutorialsIndex = (query: string): TutorialBasicData[] =>
  tutorials_index.searchFromIndex(query) as TutorialBasicData[];

// ─────────────────────────────────────────────────────────────────────────────
//  GET USER TUTORIALS
// ─────────────────────────────────────────────────────────────────────────────

export const getUserTutorialsBasicData =
  (user_handle: string) =>
  async (firestore: Firestore, dispatch: Dispatch): Promise<void> => {
    try {
      dispatch({ type: actions.GET_USER_TUTORIALS_BASIC_START });

      const snapshot = await firestore
        .collection("tutorials")
        .where("editors", "array-contains", user_handle)
        .get();

      const index: TutorialBasicData[] = snapshot.empty
        ? []
        : snapshot.docs.map((doc) => {
            const entry: TutorialBasicData = {
              owner:          user_handle,
              tutorial_id:    doc.id,
              title:          (doc.get("title") as string)          || "",
              summary:        (doc.get("summary") as string)        || "",
              featured_image: (doc.get("featured_image") as string) || "",
              icon:           (doc.get("icon") as string)           || "",
              isPublished:    (doc.get("isPublished") as boolean)   || false,
            };
            tutorials_index.addDocToIndex(entry);
            return entry;
          });

      dispatch({
        type:    actions.GET_USER_TUTORIALS_BASIC_SUCCESS,
        payload: { owner: user_handle, tutorials: index },
      });
    } catch (e) {
      dispatch({
        type:    actions.GET_USER_TUTORIALS_BASIC_FAIL,
        payload: (e as Error).message,
      });
    }
  };

// ─────────────────────────────────────────────────────────────────────────────
//  GET ORG TUTORIALS
// ─────────────────────────────────────────────────────────────────────────────

export const getOrgTutorialsBasicData =
  (organizations: string[]) =>
  async (firestore: Firestore, dispatch: Dispatch): Promise<void> => {
    try {
      dispatch({ type: actions.GET_ORG_TUTORIALS_BASIC_START });

      const getFinalData = async (
        handle: string
      ): Promise<TutorialBasicData[]> => {
        const snapshot = await firestore
          .collection("tutorials")
          .where("owner", "==", handle)
          .get();

        if (snapshot.empty) return [];

        return snapshot.docs.map((doc) => {
          const entry: TutorialBasicData = {
            owner:          handle,
            tutorial_id:    doc.id,
            title:          (doc.get("title") as string)          || "",
            summary:        (doc.get("summary") as string)        || "",
            featured_image: (doc.get("featured_image") as string) || "",
            icon:           (doc.get("icon") as string)           || "",
          };
          tutorials_index.addDocToIndex(entry);
          return entry;
        });
      };

      let index: OrgTutorialIndex[] = [];

      if (organizations.length > 0) {
        const promises = organizations.map(async (org_handle) => ({
          owner:     org_handle,
          tutorials: await getFinalData(org_handle),
        }));
        index = await Promise.all(promises);
      }

      dispatch({
        type:    actions.GET_ORG_TUTORIALS_BASIC_SUCCESS,
        payload: index.flat(),
      });
    } catch (e) {
      dispatch({
        type:    actions.GET_ORG_TUTORIALS_BASIC_FAIL,
        payload: (e as Error).message,
      });
    }
  };

export const clearTutorialsBasicData =
  () =>
  (dispatch: Dispatch): void =>
    dispatch({ type: actions.CLEAR_TUTORIALS_BASIC_STATE });

// ─────────────────────────────────────────────────────────────────────────────
//  CREATE TUTORIAL
// ─────────────────────────────────────────────────────────────────────────────

export const createTutorial =
  (tutorialData: CreateTutorialInput) =>
  async (
    firebase: Firebase,
    firestore: Firestore,
    dispatch: Dispatch,
    history: { push: (path: string) => void }
  ): Promise<void> => {
    try {
      dispatch({ type: actions.CREATE_TUTORIAL_START });

      const { title, summary, owner, created_by, is_org, tags } = tutorialData;

      const setData = async (): Promise<string> => {
        const document = firestore.collection("tutorials").doc();
        const documentID = document.id;
        const step_id = `${documentID}_${new Date().getTime()}`;

        await document.set({
          created_by,
          editors:          [created_by],
          isPublished:      false,
          owner,
          summary,
          title,
          tutorial_id:      documentID,
          featured_image:   "",
          icon:             "",
          tut_tags:         tags,
          url:              "",
          background_color: "#ffffff",
          text_color:       "#000000",
          createdAt:        firestore.FieldValue.serverTimestamp(),
          updatedAt:        firestore.FieldValue.serverTimestamp(),
        });

        await addNewTutorialStep({
          owner,
          tutorial_id: documentID,
          title:       "Step One",
          time:        5,
          id:          step_id,
        })(firebase, firestore, dispatch);

        return documentID;
      };

      await updateTagFrequencies(tags)(firebase, firestore);

      const documentID = await setData();
      history.push(`/tutorials/${owner}/${documentID}`);

      dispatch({ type: actions.CREATE_TUTORIAL_SUCCESS });
    } catch (e) {
      console.error("CREATE_TUTORIAL_FAIL", e);
      dispatch({
        type:    actions.CREATE_TUTORIAL_FAIL,
        payload: (e as Error).message,
      });
    }
  };

// ─────────────────────────────────────────────────────────────────────────────
//  TAG FREQUENCIES
// ─────────────────────────────────────────────────────────────────────────────

export const updateTagFrequencies =
  (tags: string[]) =>
  async (firebase: Firebase, firestore: Firestore): Promise<void> => {
    const tagCollectionRef = firestore.collection("tag_frequencies");

    for (const tag of tags) {
      const tagDocRef = tagCollectionRef.doc(tag);
      await firestore.runTransaction(async (transaction) => {
        const tagDoc = await transaction.get(tagDocRef);
        if (tagDoc.exists) {
          const newCount = ((tagDoc.data()?.count as number) || 0) + 1;
          transaction.update(tagDocRef, { count: newCount });
        } else {
          transaction.set(tagDocRef, { count: 1 });
        }
      });
    }
  };

export const getTutorialsByTopTags =
  (limit = 10) =>
  async (firebase: Firebase, firestore: Firestore): Promise<Tutorial[]> => {
    const tagSnapshot = await firestore
      .collection("tag_frequencies")
      .orderBy("count", "desc")
      .limit(limit)
      .get();

    const topTags = tagSnapshot.docs.map((doc) => doc.id);

    const tutorialSnapshot = await firestore
      .collection("tutorials")
      .where("tut_tags", "array-contains-any", topTags)
      .get();

    return tutorialSnapshot.docs.map((doc) => doc.data() as Tutorial);
  };

// ─────────────────────────────────────────────────────────────────────────────
//  GET CURRENT TUTORIAL
// ─────────────────────────────────────────────────────────────────────────────

export const checkUserOrOrgHandle =
  (handle: string) =>
  async (firebase: Firebase, firestore: Firestore): Promise<"user" | "organization"> => {
    const [userHandleExists, orgHandleExists] = await Promise.all([
      checkUserHandleExists(handle)(firebase),
      checkOrgHandleExists(handle)(firestore),
    ]);

    if (userHandleExists && !orgHandleExists) return "user";
    if (!userHandleExists && orgHandleExists) return "organization";
    throw new Error("Internal server error");
  };

export const getCurrentTutorialData =
  (owner: string, tutorial_id: string): ThunkFn<Tutorial | null> =>
  async (firebase, firestore, dispatch) => {
    try {
      dispatch({ type: actions.GET_CURRENT_TUTORIAL_START });

      const tutorialDoc = await firestore
        .collection("tutorials")
        .doc(tutorial_id)
        .get();

      const stepsSnapshot = await firestore
        .collection("tutorials")
        .doc(tutorial_id)
        .collection("steps")
        .get();

      const stepsObj: Record<string, TutorialStep> = {};
      stepsSnapshot.forEach((step) => {
        stepsObj[step.id] = step.data() as TutorialStep;
      });

      const steps: TutorialStep[] = _.orderBy(
        Object.values(stepsObj),
        ["id"],
        ["asc"]
      ).filter((s) => !s.deleted);

      const tutorialData: Tutorial = {
        ...(tutorialDoc.data() as Tutorial),
        steps,
        tutorial_id,
      };

      dispatch({
        type:    actions.GET_CURRENT_TUTORIAL_SUCCESS,
        payload: tutorialData,
      });

      return tutorialData;
    } catch (e) {
      console.log("GET_CURRENT_TUTORIAL_FAIL", e);
      window.location.href = "/";
      dispatch({
        type:    actions.GET_CURRENT_TUTORIAL_FAIL,
        payload: (e as Error).message,
      });
      return null;
    }
  };

// ─────────────────────────────────────────────────────────────────────────────
//  STEP MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export const addNewTutorialStep =
  ({ owner, tutorial_id, title, time, id }: AddStepInput): ThunkFn =>
  async (firebase, firestore, dispatch) => {
    try {
      dispatch({ type: actions.CREATE_TUTORIAL_STEP_START });

      await firestore
        .collection("tutorials")
        .doc(tutorial_id)
        .collection("steps")
        .doc(id)
        .set({
          content:    `Switch to editor mode to begin <b>${title}</b> step`,
          id,
          time,
          title,
          visibility: true,
          deleted:    false,
        });

      await getCurrentTutorialData(owner, tutorial_id)(
        firebase,
        firestore,
        dispatch
      );

      dispatch({ type: actions.CREATE_TUTORIAL_STEP_SUCCESS });
    } catch (e) {
      console.log("CREATE_TUTORIAL_STEP_FAIL", (e as Error).message);
      dispatch({
        type:    actions.CREATE_TUTORIAL_STEP_FAIL,
        payload: (e as Error).message,
      });
    }
  };

export const clearCreateTutorials =
  () =>
  (dispatch: Dispatch): void =>
    dispatch({ type: actions.CLEAR_CREATE_TUTORIALS_STATE });

export const getCurrentStepContentFromFirestore =
  (tutorial_id: string, step_id: string) =>
  async (firestore: Firestore, dispatch: Dispatch): Promise<void> => {
    try {
      const stepContent = await firestore
        .collection("tutorials")
        .doc(tutorial_id)
        .collection("steps")
        .doc(step_id)
        .get();

      dispatch({
        type:    actions.SET_EDITOR_DATA,
        payload: (stepContent.data() as TutorialStep).content,
      });
    } catch (e) {
      console.log((e as Error).message);
    }
  };

export const setCurrentStepContent =
  (tutorial_id: string, step_id: string, content: string) =>
  async (firestore: Firestore, dispatch: Dispatch): Promise<void> => {
    try {
      await firestore
        .collection("tutorials")
        .doc(tutorial_id)
        .collection("steps")
        .doc(step_id)
        .update({
          content,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });

      dispatch({ type: actions.SET_EDITOR_DATA, payload: content });
    } catch (e) {
      console.log(e);
    }
  };

export const hideUnHideStep =
  (
    owner:       string,
    tutorial_id: string,
    step_id:     string,
    visibility:  boolean
  ): ThunkFn =>
  async (firebase, firestore, dispatch) => {
    try {
      await firestore
        .collection("tutorials")
        .doc(tutorial_id)
        .collection("steps")
        .doc(step_id)
        .update({
          visibility: !visibility,
          updatedAt:  firestore.FieldValue.serverTimestamp(),
        });

      await getCurrentTutorialData(owner, tutorial_id)(
        firebase,
        firestore,
        dispatch
      );
    } catch (e) {
      console.log((e as Error).message);
    }
  };

export const publishUnpublishTutorial =
  (owner: string, tutorial_id: string, isPublished: boolean): ThunkFn =>
  async (firebase, firestore, dispatch) => {
    try {
      await firestore.collection("tutorials").doc(tutorial_id).update({
        isPublished: !isPublished,
      });

      const result = await getCurrentTutorialData(
        owner,
        tutorial_id
      )(firebase, firestore, dispatch);

      if (!isPublished && result) {
        addNotification(
          tutorial_id,
          result.title,
          result.created_by,
          owner
        )(firebase, firestore, dispatch);
      }
    } catch (e) {
      console.log((e as Error).message);
    }
  };

export const removeStep =
  (
    owner:            string,
    tutorial_id:      string,
    step_id:          string,
    current_step_no:  number
  ): ThunkFn =>
  async (firebase, firestore, dispatch) => {
    try {
      await firestore
        .collection("tutorials")
        .doc(tutorial_id)
        .collection("steps")
        .doc(step_id)
        .delete();

      await setCurrentStepNo(
        current_step_no > 0 ? current_step_no - 1 : current_step_no
      )(dispatch);

      await getCurrentTutorialData(owner, tutorial_id)(
        firebase,
        firestore,
        dispatch
      );
    } catch (e) {
      console.log((e as Error).message);
    }
  };

export const setCurrentStep =
  (data: string) =>
  async (dispatch: Dispatch): Promise<void> =>
    dispatch({ type: actions.SET_EDITOR_DATA, payload: data });

export const setCurrentStepNo =
  (data: number) =>
  async (dispatch: Dispatch): Promise<void> =>
    dispatch({ type: actions.SET_CURRENT_STEP_NO, payload: data });

// ─────────────────────────────────────────────────────────────────────────────
//  IMAGE UPLOAD
// ─────────────────────────────────────────────────────────────────────────────

export const uploadTutorialImages =
  (owner: string, tutorial_id: string, files: File[]): ThunkFn =>
  async (firebase, firestore, dispatch) => {
    try {
      dispatch({ type: actions.TUTORIAL_IMAGE_UPLOAD_START });

      const type = await checkUserOrOrgHandle(owner)(firebase, firestore);
      const storagePath = `tutorials/${type}/${owner}/${tutorial_id}`;
      const dbPath = "tutorials";

      await (firebase as any).uploadFiles(storagePath, files, dbPath, {
        metadataFactory: (
          _uploadRes: unknown,
          firebase: Firebase,
          metadata: { name: string },
          downloadURL: string
        ) => ({
          imageURLs: (firebase.firestore as any).FieldValue.arrayUnion({
            name: metadata.name,
            url:  downloadURL,
          }),
        }),
        documentId: tutorial_id,
      });

      await getCurrentTutorialData(owner, tutorial_id)(
        firebase,
        firestore,
        dispatch
      );

      dispatch({ type: actions.TUTORIAL_IMAGE_UPLOAD_SUCCESS });
    } catch (e) {
      dispatch({
        type:    actions.TUTORIAL_IMAGE_UPLOAD_FAIL,
        payload: (e as Error).message,
      });
    }
  };

export const clearTutorialImagesReducer =
  () =>
  (dispatch: Dispatch): void =>
    dispatch({ type: actions.CLEAR_TUTORIAL_IMAGES_STATE });

export const remoteTutorialImages =
  (owner: string, tutorial_id: string, name: string, url: string): ThunkFn =>
  async (firebase, firestore, dispatch) => {
    try {
      dispatch({ type: actions.TUTORIAL_IMAGE_DELETE_START });

      const type = await checkUserOrOrgHandle(owner)(firebase, firestore);
      const storagePath = `tutorials/${type}/${owner}/${tutorial_id}/${name}`;

      await (firebase as any).deleteFile(storagePath);

      await firestore
        .collection("tutorials")
        .doc(tutorial_id)
        .update({
          imageURLs: (firebase.firestore as any).FieldValue.arrayRemove({
            name,
            url,
          }),
        });

      await getCurrentTutorialData(owner, tutorial_id)(
        firebase,
        firestore,
        dispatch
      );

      dispatch({ type: actions.TUTORIAL_IMAGE_DELETE_SUCCESS });
    } catch (e) {
      dispatch({
        type:    actions.TUTORIAL_IMAGE_DELETE_FAIL,
        payload: (e as Error).message,
      });
    }
  };

// ─────────────────────────────────────────────────────────────────────────────
//  STEP METADATA
// ─────────────────────────────────────────────────────────────────────────────

export const updateStepTitle =
  (
    owner:       string,
    tutorial_id: string,
    step_id:     string,
    step_title:  string
  ): ThunkFn =>
  async (firebase, firestore, dispatch) => {
    try {
      await firestore
        .collection(`tutorials/${tutorial_id}/steps`)
        .doc(step_id)
        .update({
          title:     step_title,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });

      await getCurrentTutorialData(owner, tutorial_id)(
        firebase,
        firestore,
        dispatch
      );
    } catch (e) {
      console.log(e);
    }
  };

export const updateStepTime =
  (
    owner:       string,
    tutorial_id: string,
    step_id:     string,
    step_time:   number
  ): ThunkFn =>
  async (firebase, firestore, dispatch) => {
    try {
      await firestore
        .collection(`tutorials/${tutorial_id}/steps`)
        .doc(step_id)
        .update({
          time:      step_time,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });

      await getCurrentTutorialData(owner, tutorial_id)(
        firebase,
        firestore,
        dispatch
      );
    } catch (e) {
      console.log((e as Error).message);
    }
  };

export const setTutorialTheme =
  ({ tutorial_id, owner, bgColor, textColor }: TutorialThemeInput): ThunkFn =>
  async (firebase, firestore, dispatch) => {
    try {
      await firestore.collection("tutorials").doc(tutorial_id).update({
        text_color:       textColor,
        background_color: bgColor,
        updatedAt:        firestore.FieldValue.serverTimestamp(),
      });

      await getCurrentTutorialData(owner, tutorial_id)(
        firebase,
        firestore,
        dispatch
      );
    } catch (e) {
      console.log((e as Error).message);
    }
  };

// ─────────────────────────────────────────────────────────────────────────────
//  NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

export const addNotification =
  (
    tutorial_id:   string,
    tutorialTitle: string,
    created_by:    string,
    owner:         string
  ): ThunkFn =>
  async (firebase, firestore, dispatch) => {
    try {
      dispatch({ type: actions.ADD_NOTIFICATION_START });

      const [querySnapshot, isSubscribed] = await Promise.all([
        firestore
          .collection("notifications")
          .where("tutorial_id", "==", tutorial_id)
          .get(),
        isUserSubscribed(owner, firebase, firestore),
      ]);

      if (querySnapshot.empty && isSubscribed) {
        const document = firestore.collection("notifications").doc();
        const documentID = document.id;

        const notification: Notification = {
          notification_id: documentID,
          content: `Posted new Tutorial ${tutorialTitle}. Learn the best practices followed in the industry in this tutorial.`,
          createdAt:   firestore.FieldValue.serverTimestamp() as firebase.firestore.Timestamp,
          isRead:      false,
          username:    created_by,
          org:         owner,
          tutorial_id,
        };

        await document.set(notification);
      }

      dispatch({ type: actions.ADD_NOTIFICATION_SUCCESS });
    } catch (e) {
      console.error("ADD_NOTIFICATION_FAILED", e);
      dispatch({
        type:    actions.ADD_NOTIFICATION_FAILED,
        payload: (e as Error).message,
      });
    }
  };

export const getNotificationData = (): ThunkFn =>
  async (firebase, firestore, dispatch) => {
    try {
      dispatch({ type: actions.GET_NOTIFICATION_DATA_START });

      const snapshot = await firestore
        .collection("notifications")
        .orderBy("createdAt", "desc")
        .get();

      const notifications: Notification[] = snapshot.docs.map(
        (doc) => doc.data() as Notification
      );

      dispatch({
        type:    actions.GET_NOTIFICATION_DATA_SUCCESS,
        payload: notifications,
      });
    } catch (e) {
      console.log(e);
      dispatch({
        type:    actions.GET_NOTIFICATION_DATA_FAIL,
        payload: (e as Error).message,
      });
    }
  };

export const readNotification =
  (notification_id: string): ThunkFn =>
  async (firebase, firestore, dispatch) => {
    try {
      await firestore
        .collection("notifications")
        .doc(notification_id)
        .update({ isRead: true });

      dispatch({ type: actions.READ_NOTIFICATION, payload: notification_id });
    } catch (e) {
      console.log((e as Error).message);
    }
  };

export const deleteNotification =
  (notification_id: string): ThunkFn =>
  async (firebase, firestore, dispatch) => {
    try {
      await firestore
        .collection("notifications")
        .doc(notification_id)
        .delete();

      dispatch({
        type:    actions.DELETE_NOTIFICATION,
        payload: notification_id,
      });
    } catch (e) {
      console.log((e as Error).message);
    }
  };
