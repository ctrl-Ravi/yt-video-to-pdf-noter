# YT Noter Pro — Full Build Implementation Guide

> This document tells you exactly how to build the project phase by phase.
> Every phase has a goal, prerequisites, step-by-step build order, decisions to make,
> things that will go wrong, and a verification checklist before moving on.
> Read the Architecture Plan first. This document assumes you know it.

---

## Before you start anything

Set up your development environment once and do not touch it again until every phase is complete.

Install Node.js 20 or higher. Install Python 3.11 or higher. Install pnpm as your package manager — it handles monorepo workspaces cleanly. Do not use npm or yarn. Install the Chrome browser for testing. Do not use Chromium — extension APIs occasionally behave differently.

Create a monorepo at the root with three workspaces: one for the extension, one for the backend, and one for shared TypeScript types. The shared types workspace is a plain TypeScript package with no build output — it is consumed directly by the extension and the web app via workspace references. The web app is a fourth workspace added in Phase 12.

Set up Git from the start. Commit at the end of every phase. Tag each phase completion. If something breaks in a later phase, you can diff cleanly against the last working tag.

Install the WXT browser tools extension in Chrome. It gives you a panel in DevTools that shows your extension's storage, messages between scripts, and service worker state. You will use this constantly.

Create a dedicated Chrome profile for development. Never test your extension in your personal Chrome profile. Extension errors in development can corrupt storage and interfere with other extensions.

---

## Phase 1 — Local data foundation

### Goal

A fully working local database layer with zero UI. Every operation the product will ever perform on local data is implemented, tested, and verified before any component is written.

### Prerequisites

The monorepo is set up. The shared types workspace exists. Nothing else.

### Why this phase comes first

Every other phase depends on this layer. If the data model is wrong, every phase built on top of it breaks. Fixing data model mistakes after UI is built is ten times harder than fixing them before. Build the foundation correctly once.

### Step 1 — Define the TypeScript types in the shared package

Start with the note project structure. Define the top-level note type with all fields described in the architecture plan. Every field must be typed strictly — no any, no unknown, no optional fields that should be required. Use discriminated union types for the annotation type field so TypeScript enforces that a freehand stroke has point data and a rectangle has width and height. Use a string literal union for sync status values. Use a string literal union for capture method values.

Define the notebook type. Define the study session type. Define the sync queue entry type. Define the search index entry type. Define the local preferences type.

These types are the contract between every part of the system. Every package in the monorepo imports from the shared types package. Nothing defines its own local version of these types.

When defining the annotation point type, represent x and y as numbers between 0 and 1. Add a validation function that asserts a point is within this range. This validation is called at every point where annotation data enters the system from outside — import, sync pull, and annotation canvas save.

### Step 2 — Set up Dexie with all tables

In the extension workspace, install Dexie and Dexie-React-Hooks. Create the database class that extends Dexie. Define version 1 of the schema.

The schema defines these tables and their indexes. The notes table has a primary key of the note UUID string, with indexes on notebook UUID, study session UUID, video URL, last-modified timestamp descending, sync status, and deleted flag. The notebooks table has a primary key of the notebook UUID. The study sessions table has a primary key of the session UUID with an index on video URL and an index on status. The thumbnails table has a primary key of the note UUID — one row per note. The screenshots table has a primary key of the note UUID — one row per note. The sync queue table has a primary key of its own UUID with indexes on the target provider identifier, the note UUID it refers to, and the next retry timestamp. The search index table has a primary key of the note UUID. The preferences table has a primary key of a fixed string key — this table effectively has one row. The export cache table has a primary key combining note UUID and export type, with an index on the generated-at timestamp for TTL queries.

After defining the schema, write a database initialisation function that opens the database and returns the Dexie instance. This function is called once at extension startup. The instance is shared across all database operations via a module-level singleton — never create multiple Dexie instances.

### Step 3 — Write all Dexie operation functions

Write one function for each distinct database operation. Do not write class methods. Write plain async functions that accept parameters and return typed results. This makes testing trivial — every function can be called directly in a test without mounting any component.

For notes: create a note, get a note by UUID, get all notes in a notebook sorted by display order, get all notes for a video URL, get all notes modified after a given timestamp, update note text content, update note annotation array, update note sync status, soft-delete a note by UUID, hard-delete a note by UUID and remove its image tiers, get all notes with sync status pending.

For notebooks: create a notebook, get all notebooks sorted by display order, rename a notebook and update all its notes in a single transaction, delete a notebook and soft-delete all its notes.

For study sessions: create a session, update session end timestamp, complete a session, get the active session for a video URL, get all sessions sorted by start timestamp descending, get all notes belonging to a session.

For the image tiers: write a thumbnail blob for a note UUID, read a thumbnail blob by note UUID, write a full screenshot blob for a note UUID, read a full screenshot blob by note UUID, delete both image tiers for a note UUID.

For the sync queue: enqueue an operation, get all queue entries with next retry timestamp in the past, mark an entry as succeeded and delete it, increment retry count and set next retry timestamp, mark an entry as error status.

For the search index: write or overwrite a search index entry, delete a search index entry, scan the entire index for a query string and return matching note UUIDs.

For the export cache: write a cache entry, read a cache entry by note UUID and type, delete all cache entries older than 24 hours.

For preferences: read all preferences, write a single preference key.

Every function that modifies a note must update the search index in the same Dexie transaction. This is not optional. Use Dexie's transaction method to wrap both operations. If either fails, both roll back.

Every function that modifies a note that has a study session UUID must update the session's note UUID array in the same transaction.

### Step 4 — Implement the image compression pipeline

Install the CompressionStream API type declarations. The compression pipeline itself runs in a Web Worker. In the extension workspace, create a worker file that accepts a message containing raw image data as an ArrayBuffer and the original image dimensions, and replies with two blobs — the compressed full screenshot and the thumbnail.

Inside the worker, implement the format decision logic. Create an OffscreenCanvas at the image dimensions. Put the raw pixel data onto it. Sample a grid of 100 evenly spaced pixels. Calculate the standard deviation of hue values across those samples. If standard deviation is below a threshold — indicating mostly uniform colors typical of text and diagrams — use PNG. Otherwise use JPEG at 0.85 quality. The threshold is 15 degrees of hue standard deviation. This value is empirical and may need adjustment after testing with real screenshots.

Implement the resize step. If either dimension exceeds 1920 pixels, calculate the scale factor that brings the longest side to exactly 1920. Create a new OffscreenCanvas at the scaled dimensions. Draw the original image data onto it using drawImage. The scaled canvas is now the working image.

Generate the thumbnail. Create another OffscreenCanvas with the same aspect ratio but capped at 320 pixels on the longest side. Draw the working image onto it using drawImage. Export as JPEG at 0.7 quality.

Post both blobs back to the calling code.

In the main thread, write a wrapper function that creates the worker on first call — a lazy singleton — posts the message, and returns a promise that resolves when the worker posts back. The promise resolves with an object containing the full screenshot blob and the thumbnail blob. Wrap the entire worker call in a try-catch. If it throws, fall back to storing the raw image data from an OffscreenCanvas at original dimensions without any compression, and set the uncompressed flag on the note.

### Step 5 — Implement storage quota monitoring

Write a function that calls the StorageManager API and returns the current usage in bytes and the quota in bytes. Calculate the percentage used. Write the result and the current timestamp to the preferences table. Return the result to the caller.

Write a second function that reads the last-known usage from preferences and returns whether usage is above 80 percent. This is the function that other code calls to decide whether to show a warning — it reads from preferences rather than calling StorageManager every time, since StorageManager itself is an async operation.

Write the weekly cleanup function. It deletes all export cache entries older than 24 hours. Then it reads the last-known usage. If usage is above 80 percent, it gets all note UUIDs where the sync status is synced and the last-modified timestamp is older than 90 days. For each of those UUIDs, it deletes the Tier 3 screenshot entry if it exists. It does not touch the note metadata, the thumbnail, or the annotations. After cleanup, it runs storage monitoring again and writes the new result to preferences.

Write the orphaned screenshot cleanup function. Read all keys from the thumbnails table. Read all keys from the screenshots table. Read all note UUIDs from the notes table. Delete any thumbnail or screenshot entry whose key does not appear in the note UUID set. This function runs as part of the weekly cleanup routine.

### Step 6 — Write the test suite

Do not skip this step. The data layer is the most critical part of the system and the hardest to debug once UI is on top of it.

Install Vitest. Configure it to run in a jsdom environment with fake IndexedDB — install fake-indexeddb and configure Dexie to use it. Every test starts with a fresh in-memory database so tests are completely isolated.

Write tests for these scenarios:

Creating a note writes the correct fields to all tables — Tier 1 metadata, Tier 2 thumbnail, Tier 3 screenshot, and search index — all in one transaction. Verify by reading each table individually after the write.

Updating note text increments the version counter, updates last-modified, writes the new search index entry, and invalidates the export cache key. Verify each.

Soft-deleting a note sets the deleted flag, updates last-modified, removes the search index entry, and does not remove the Tier 2 or Tier 3 entries. Verify each.

Hard-deleting a note removes all four tiers. Verify the note, thumbnail, screenshot, and search index entries are all gone.

Creating a note with a study session UUID updates the session's note UUID array. Verify the session object after the note write.

Searching for a keyword in the search index returns the correct note UUIDs. Verify with multiple notes where only some match.

The orphaned screenshot cleanup deletes image tier entries for a UUID that does not exist in the notes table. Verify before and after.

The export cache TTL cleanup deletes entries older than 24 hours and keeps entries newer than 24 hours. Verify both.

Creating a notebook and creating a note in it sets the correct notebook UUID on the note. Renaming the notebook updates all notes in it. Verify by reading notes after rename.

All tests must pass before continuing to Phase 2.

### Phase 1 verification checklist

Every test passes with zero failures. The Dexie schema version is 1 with no outstanding migrations. The compression pipeline test accepts a sample canvas image and returns two blobs with different sizes. Storage quota monitoring returns a numeric percentage. The type definitions compile with strict TypeScript with zero errors. No any types are present anywhere in the shared types package.

---

## Phase 2 — Platform abstraction and screenshot capture

### Goal

A working screenshot capability that operates on any HTML5 video page, abstracted behind an interface that the rest of the system always uses.

### Prerequisites

Phase 1 complete and all tests passing.

### Step 1 — Define the platform interface

In the extension workspace, define the platform interface as a TypeScript interface. It has these methods: detectVideo which returns whether a playable video exists on the current page; getVideoElement which returns the current HTMLVideoElement or null; getCurrentTimestamp which returns the current playback position in seconds; getVideoTitle which returns the detected title string; getPlatformIdentifier which returns a platform string; captureFrame which returns a promise resolving to an object containing the raw image data and the capture method used; onNavigate which accepts a callback that fires whenever the page navigates to a different video without a full page reload.

### Step 2 — Implement the generic platform

The generic implementation scans the document for all video elements. It selects the one that is currently playing — paused is false — or if none is playing, the one with the most pixels visible in the viewport. It reads the document title for the video title. The platform identifier is the string generic. It calls the screenshot capture function described in Step 4. For navigation detection, it observes URL changes using the History API pushState and replaceState override pattern.

Write a helper function that finds the video element most visible in the viewport. It calls getBoundingClientRect on each video element, calculates what fraction of the element is within the viewport bounds, and returns the element with the highest fraction. If no video elements exist, it returns null.

### Step 3 — Implement the YouTube platform

The YouTube implementation is a superset of the generic implementation with three overrides.

For getVideoElement, it first tries the generic method. If that returns null, it specifically queries for the selector that YouTube uses for its primary player. This selector is fragile — YouTube changes it occasionally. Make the selector a named constant at the top of the implementation file so it is easy to find and update.

For getVideoTitle, it reads from the YouTube page structure. YouTube renders the video title in a specific heading element. Read that element's text content. If not found, fall back to the document title minus the YouTube suffix.

For onNavigate, YouTube does not perform full page reloads between videos. It uses its own internal navigation that updates the URL without triggering standard navigation events. Observe both the URL change pattern and a YouTube-specific custom event that fires on video load. Call the provided callback on either trigger.

### Step 4 — Implement screenshot capture

Write the capture function that the platform implementations call. It tries frame extraction first, then tab capture fallback.

Frame extraction: get the video element from the platform. Create an OffscreenCanvas at the video's videoWidth by videoHeight. Call drawImage with the video element. Convert the canvas to an ArrayBuffer using the toBlob method followed by arrayBuffer. Send this to the compression pipeline worker. Return the result. If any step throws — including if the video element is null, or if drawImage throws a SecurityError because the video is cross-origin — catch the error, log it, and proceed to the tab capture fallback.

Tab capture fallback: the content script cannot call the tab capture API directly. It sends a message to the background service worker requesting a screenshot. The service worker calls the capture API and messages the result back. The content script receives the result as a base64 string. It decodes it to an ArrayBuffer. It then calculates the bounding rectangle of the video element using getBoundingClientRect. It crops the captured image to that rectangle by drawing the relevant portion onto an OffscreenCanvas. It sends the cropped image to the compression pipeline. Tab capture requires the user's permission — the first time it is needed, the content script shows an inline permission prompt in the sidebar before sending the message to the service worker. If the user declines, the function throws a UserDeclinedError that the caller handles by showing a non-crashing message.

### Step 5 — Implement platform detection

Write the platform detector function. It checks whether the current URL matches youtube.com. If yes, it creates a YouTube platform instance. Otherwise it creates a generic platform instance. This function is called once when the content script initialises. The result is stored in a module-level variable. Every other part of the content script imports and calls this variable. The platform detector function is the only place that ever branches on the URL.

### Step 6 — Test manually

Load the extension in Chrome. Go to a YouTube video. Open the DevTools console. Call the platform instance methods manually via the console: detectVideo, getVideoElement, getCurrentTimestamp, getVideoTitle, getPlatformIdentifier. Verify every method returns a reasonable value.

Go to a generic HTML5 video page — the HTML5 test page at html5test.openideo.com is a good option. Verify the generic platform works.

Go to a YouTube video that is served via MSE — most YouTube videos are. Verify that captureFrame via drawImage succeeds and produces a non-blank image.

Then test the fallback path. Temporarily modify the frame extraction step to always throw. Verify that captureFrame falls through to the tab capture path, shows the permission prompt, and after permission is granted, returns an image of the video area.

Go to a DRM-protected page — any Netflix title will do. Verify the extension does not crash. Verify that frame extraction fails gracefully, that tab capture returns a blank or non-video frame correctly, and that the sidebar shows a clear message that screenshot capture is not available for this content.

### Phase 2 verification checklist

Platform detection selects YouTube on youtube.com and generic everywhere else. Frame extraction returns a non-blank image on YouTube. Timestamp reads the correct playback position. Title reads the correct video title. Fallback to tab capture works after simulated frame extraction failure. DRM-protected video does not crash the extension. The compression pipeline processes the captured frame and returns two blobs.

---

## Phase 3 — WXT project and shadow DOM setup

### Goal

A Chrome extension that loads without errors, injects a minimal placeholder into any video page, and shows a working empty popup.

### Prerequisites

Phases 1 and 2 complete. The monorepo structure is set up.

### Step 1 — Initialise the WXT project

Run the WXT project initialisation inside the extension workspace. Choose the React and TypeScript template. WXT generates the entry points structure — content script, background service worker, and popup.

Install the required packages: Tailwind CSS, the WXT Tailwind plugin, shadcn/ui CLI, Dexie, Dexie-React-Hooks, TanStack Virtual, React Query, and Zustand.

Configure the shared types package as a workspace dependency so the extension can import from it.

### Step 2 — Configure Tailwind for shadow DOM

This is the most technically tricky part of Phase 3. Tailwind works by injecting a stylesheet into the document head. Shadow DOM does not inherit styles from the document — it is isolated. This means a standard Tailwind setup produces no styles inside the sidebar.

WXT has a specific mechanism for injecting styles into the shadow DOM root. The content script entry point exports a configuration object that tells WXT to use a shadow root and to inject the component's associated stylesheet into that shadow root. Configure this according to WXT's shadow DOM documentation.

After configuring, install a Tailwind CSS injection plugin for WXT. This plugin ensures that Tailwind's generated CSS is scoped to the shadow root rather than the document head.

Verify shadow DOM isolation is working by rendering a bright red div inside the shadow root and confirming that no YouTube CSS overrides it. Then remove the test div.

### Step 3 — Install and configure shadcn/ui

shadcn/ui components depend on CSS variables for their theming. These variables are normally defined on the document body. Inside a shadow DOM, they must be defined on the shadow root's container element instead.

Run the shadcn/ui initialiser. When it asks for the CSS variable location, choose the approach that defines variables on the shadow container. The shadow container is the outermost div that WXT injects into the page.

Install an initial set of shadcn/ui components that will be needed in the first few phases: Button, Input, Textarea, Tabs, Dialog, Popover, ScrollArea, Badge, Tooltip. Do not install everything upfront — install components as they are needed.

After installation, verify that a shadcn Button component renders visibly inside the shadow root with correct styles.

### Step 4 — Set up the content script entry point

The content script entry points to a root React component. This component receives the shadow DOM container as its rendering target. The component renders nothing for now — just null. This is intentional. Phases 4 through 7 fill in this component.

The content script also initialises the platform layer on load. The platform detector function from Phase 2 is called once here. The resulting platform instance is stored in a module-level variable. Nothing else in the content script calls platform detection again.

The content script initialises the Dexie database on load. The database instance is stored in a module-level variable. Nothing else opens the database.

### Step 5 — Set up the background service worker

The background service worker entry point listens for the extension install event and the browser startup event. Both handlers currently do nothing except log a message. These will be filled in during Phase 8. The handlers must be registered now so they are present in the built manifest.

The service worker listens for messages from the content script. Currently the only message type it knows about is the tab capture request from Phase 2. Wire up that message handler now using the message handling pattern from Phase 2.

### Step 6 — Set up the popup

The popup is a separate React entry point. It renders a placeholder div with the text "YT Noter Pro loading." No styles yet. No data. Confirm it opens without errors when clicking the extension icon.

### Step 7 — Load and verify in Chrome

Build the extension with WXT in development mode. Open Chrome and go to the extensions page. Load the unpacked extension from the WXT output directory. The extension should appear without errors. Open YouTube. Confirm no console errors appear. Confirm the page layout is not broken — the shadow DOM must not inject any visible elements yet since the content script renders null.

Open the popup. Confirm it opens and shows the placeholder text. Open Chrome DevTools and find the extension's service worker in the Application panel. Confirm it is running with no errors.

### Phase 3 verification checklist

Extension loads without errors. No console errors on YouTube. Popup opens and shows content. Service worker is active. Shadow DOM injection is confirmed via DevTools element inspector. Tailwind styles render correctly inside the shadow root. shadcn Button renders with correct styles. TypeScript compilation has zero errors. WXT hot reload works — changing a component file reloads the extension automatically.

---

## Phase 4 — Sidebar shell

### Goal

A fully working sidebar shell that appears on every video page, can be dragged anywhere, resized, collapsed, and survives page navigation — with no notes functionality yet.

### Prerequisites

Phase 3 complete and verified.

### Step 1 — Define the sidebar state

Create a Zustand store for sidebar UI state. It holds: whether the sidebar is open or collapsed, the active tab which is either session or manager, whether auto-snap is on, the current sidebar dimensions and position (treated as UI state, not persisted to Dexie), and the compact mode flag. The store is created once and imported wherever needed. Components never define their own local state for things this store covers.

The actual position and size values are NOT stored in Zustand. They are applied directly to the DOM element and persisted to extension storage via WXT's typed storage API. This prevents React from re-rendering the entire sidebar on every pixel moved during drag.

### Step 2 — Build the shell layer

The shell layer is the outermost div that contains everything. It has a fixed position, a high z-index, and dimensions read from extension storage on mount. On mount, it reads the saved position and size from storage and applies them as inline styles.

The shell contains one resize handle on its left edge — a narrow vertical strip. Clicking and dragging this handle changes the shell's width. The drag logic uses pointer events, not mouse events. On pointerdown on the resize handle, capture the pointer. On pointermove, calculate the new width from the delta and apply it directly to the shell's style property. On pointerup, release the pointer capture and save the new width to extension storage. Clamp the width between 300 and 640 pixels. When width drops below 320 pixels, add a compact class to the shell. When width goes back above 320 pixels, remove it.

### Step 3 — Build the drag handle

The drag handle is a thin horizontal bar across the top of the shell. It has a visible grip indicator — three short horizontal lines or dots centred in it. Clicking and dragging it moves the entire sidebar.

The drag logic: on pointerdown on the handle, record the starting cursor position and the shell's current getBoundingClientRect left and top values. Switch the shell's CSS positioning from right-anchored to left-and-top-anchored. On pointermove, calculate the new left and top by adding the cursor delta to the starting shell position. Clamp so the shell cannot go off-screen — left is clamped between 0 and window innerWidth minus shell width, top is clamped between 0 and window innerHeight minus 60. On pointerup, save the final left and top to extension storage.

When the shell mounts, if no saved position exists in storage, default to right-anchored positioning near the right edge of the viewport at vertical centre.

### Step 4 — Build the layout layer

Inside the shell, the layout layer contains three vertical sections: the drag handle at the top, the header below it, and the content area filling the remaining space.

The header contains two rows. The top row has the logo mark, the extension name, and the two toggle controls — the auto-snap pill and the hide button. The second row has the notebook selector dropdown.

The logo mark is a small colored square with an icon. The extension name is a text label. The auto-snap pill has a colored indicator dot and the text AUTO. Clicking it toggles the auto-snap value in the Zustand store. When auto-snap is on, the dot glows green. When off, the dot is dim. The hide button is a small icon button that sets the sidebar open state to collapsed in the Zustand store.

The notebook selector is a shadcn/ui Select component. It reads notebooks from Dexie using Dexie-React-Hooks. Changes update the active notebook in the Zustand store.

The content area uses flex-grow to fill remaining space. It renders the active panel based on the Zustand store's active tab — either the session panel placeholder or the manager panel placeholder. Both placeholders are empty divs for now.

### Step 5 — Implement collapse behaviour

When the sidebar is collapsed, its height shrinks to show only the drag handle and header. The content area is hidden. The hide button's icon changes to indicate the sidebar can be expanded. A subtle hover effect on the collapsed bar should expand it temporarily on hover — useful when taking notes while watching fullscreen.

When YouTube enters fullscreen via the Fullscreen API, listen for the fullscreenchange event. When fullscreen is active, the sidebar switches to mini-mode — same collapsed height as the collapsed state but with slightly higher opacity on hover. When fullscreen exits, restore the previous state.

### Step 6 — Implement the popup UI

Build the actual popup UI. It has a header with the logo and name. Below that, a list of keyboard shortcuts in two columns — action name and key combination. At the bottom, a status area showing whether the backend is reachable and whether any sync providers are connected. The status reads from extension storage. No backend calls happen inside the popup.

Use shadcn/ui Card and Badge for the layout. All styles are Tailwind classes.

### Phase 4 verification checklist

Sidebar appears on YouTube on page load. Drag moves the sidebar and position persists after page refresh. Resize changes width and compact mode activates below 320 pixels. Width persists after page refresh. Collapse toggle hides the content area. Fullscreen mode triggers mini-mode. Auto-snap toggle changes the dot color. Notebook selector shows a placeholder notebook. No console errors. No visible impact on YouTube's own layout or player controls.

---

## Phase 5 — Editor, capture, and local saving

### Goal

A complete note-taking flow that works entirely offline — capture a screenshot, write a note, save it, see it in the timeline — with no backend whatsoever.

### Prerequisites

Phase 4 complete and verified. Phase 1 database layer working. Phase 2 capture working.

### Step 1 — Build the editor component

The editor sits in the session panel, above the timeline. It has three input areas stacked vertically.

The first is the note title input. It is a plain text input with a minimal border-bottom style, placeholder text of Note title, and no background. It reads from and writes to the Zustand store's editorTitle field.

The second is the note body textarea. It auto-expands as the user types — no fixed height. It reads from and writes to the Zustand store's editorBody field. Do not use a controlled input that re-renders on every keystroke — this causes lag on slower machines. Instead use an uncontrolled input with a ref, and sync the ref value to Zustand only on blur. On focus, read the current Zustand value into the ref.

The third area is the screenshot preview. When a screenshot has been captured but not yet saved, a thumbnail preview appears here above the title input. It shows the compressed thumbnail from the compression pipeline result. It has an X button that clears the captured screenshot from the Zustand store without saving.

Below the inputs, there is a row of action buttons: Save Note, Capture Screenshot, and a small Auto-snap indicator showing the current auto-snap state.

### Step 2 — Wire up screenshot capture

The Capture Screenshot button calls the platform layer's captureFrame method. While the capture is in progress, the button shows a loading spinner. When capture completes, the resulting thumbnail blob is displayed in the editor preview area. The full screenshot blob and the thumbnail blob are stored in Zustand as pending capture data — they are not written to Dexie until the note is saved.

The auto-snap feature: when auto-snap is on in the Zustand store, screenshot capture triggers automatically whenever the video pauses. Listen for the pause event on the video element, obtained from the platform layer. On pause, call captureFrame. Store the result as pending capture data, replacing any previous pending capture. The editor preview updates automatically because it reads from Zustand.

### Step 3 — Wire up note saving

The Save Note button reads from the Zustand store: the current notebook UUID, the editor title, the editor body, the pending capture data if any, and the current study session UUID if a session is active.

It assembles the full note project object. It generates a new UUID for the note. It sets version to one. It sets sync status to local-only. It sets created-at and last-modified to now. It sets deleted to false. It records the current platform identifier, video URL, video title, timestamp string, and timestamp seconds from the platform layer. It sets the notebook UUID and display order.

If pending capture data exists, it writes the thumbnail blob to Tier 2 and the full screenshot blob to Tier 3 using the Dexie tier operations from Phase 1. The storage keys are the note UUID. The screenshot data section of the note stores these keys and the image dimensions. If no capture data exists, the screenshot fields are empty.

It calls the create note Dexie function with the assembled note object. This single call writes to Tier 1 and updates the search index atomically.

After saving, it clears the editor title, body, and pending capture from Zustand. It sets the export cache reference to empty.

It enqueues a sync operation for each connected provider in the sync queue table. Sync status for the new note becomes pending-sync.

### Step 4 — Build the session timeline

The session timeline sits below the editor in the session panel. It renders all notes in the current session in reverse chronological order — newest at the bottom.

It uses a Dexie-React-Hooks live query to observe the notes table for the current session UUID and notebook UUID. When a note is added, edited, or deleted, the live query fires and the timeline re-renders automatically. No manual refresh or polling.

It uses TanStack Virtual to render only the visible rows. The row estimator returns 120 pixels as the default height for notes without screenshots and 280 pixels for notes with screenshots. TanStack Virtual measures actual rendered heights and corrects its estimates after first render.

The scroll behaviour: during a session, new notes are added at the bottom. If the user is already at the bottom — or within 200 pixels of it — the timeline automatically scrolls to show the new note. If the user has scrolled up to review earlier notes, auto-scroll does not activate.

### Step 5 — Build the note card

Each note card is a separate component that receives a single note object as its prop. It reads its thumbnail from the Tier 2 Dexie table using a live query keyed on the note UUID. The thumbnail loads asynchronously after the card mounts. Before the thumbnail loads, the card shows a placeholder with the note dimensions to prevent layout shift.

The note card shows: the timestamp as an anchor element whose href is the video URL plus the timestamp in seconds as the t query parameter; the note title in bold if present; the thumbnail image if present; the note body text; and an action bar with edit and delete buttons.

The timestamp link opens in a new tab. Clicking the note card's body area opens an edit mode. The delete button soft-deletes the note via the Dexie delete operation and removes it from the timeline.

When the thumbnail image blob is loaded, create a Blob URL and set it as the image src. When the note card unmounts, revoke that Blob URL immediately.

### Step 6 — Test the complete offline flow

Go to a YouTube video. Capture a screenshot with the button. Type a note title and body. Save. Verify the note appears in the timeline immediately with the thumbnail. Verify the timestamp link in the card points to the correct video URL with the correct timestamp parameter. Disconnect from the internet. Create another note. Verify it saves correctly and appears in the timeline. Verify no error messages appear anywhere. Open DevTools, go to the Application panel, open IndexedDB, and verify the note data in all relevant tables.

### Phase 5 verification checklist

Screenshot capture works and shows a preview. Note saves to all Dexie tiers. Timeline updates immediately after save using live query. Note card shows thumbnail. Timestamp link is correct. Edit and delete work. Auto-snap captures on video pause. Everything works with network disabled. No Blob URL leaks — verify by looking for growing memory in Chrome Task Manager while saving many notes.

---

## Phase 6 — Study sessions

### Goal

Automatic study session grouping that requires zero user action to activate.

### Prerequisites

Phase 5 complete.

### Step 1 — Implement session auto-creation

When the platform layer fires the onNavigate callback or when the content script initialises on a video page, run the session check function. This function reads the current video URL and the current local date in the user's timezone. It queries the study sessions table for any session where the video URL matches and the start timestamp's calendar day matches today in the user's timezone.

If a matching session exists and its status is active, use it. Set the current session UUID in the Zustand store.

If a matching session exists and its status is completed, and if the difference between now and the session's end timestamp is less than two hours, show the continuation prompt. The prompt appears as a small banner at the top of the session panel with two buttons — Continue Session and Start New. If Continue is chosen, set the session status back to active and use it. If Start New is chosen, create a new session.

If no matching session exists, create a new session automatically. Set its status to active. Set the current session UUID in the Zustand store.

### Step 2 — Implement session end on navigation

When the platform layer's onNavigate fires with a different video URL, call the session end function. It sets the current session's status to completed and records the end timestamp as now. It clears the current session UUID from Zustand. Then it runs the session check function for the new URL.

When the content script's cleanup function runs — this fires when the tab is closed or navigated to a non-video page — call the session end function.

### Step 3 — Implement startup recovery

In the background service worker startup handler, query the study sessions table for any sessions with status active. For each found session, set its status to completed and its end timestamp to the last-modified timestamp of the most recent note in that session. If no notes exist in the session, set end timestamp to the session start timestamp.

### Step 4 — Build the session header

At the top of the session panel, above the editor, show a session header. It displays the session title — which defaults to the video title plus the date — the elapsed time since the session started, and the count of notes in the session. Update the elapsed time display once per minute using a standard setInterval cleared on component unmount. This is not the service worker — setInterval is fine in a React component.

Allow the user to edit the session title. Clicking the title turns it into an inline text input. On blur or Enter, save the new title to the session record in Dexie.

### Step 5 — Build the unfinished session restoration prompt

On startup, after the service worker marks abandoned sessions as completed, the content script checks whether the current video URL has any recently completed sessions from the past 24 hours when it loads on a video page. If yes, show the restoration banner described in Step 1. This check must happen after the service worker startup recovery runs. Use a brief timeout on the content script side — 500 milliseconds — to allow the service worker time to complete its startup tasks before the content script queries.

### Phase 6 verification checklist

Opening a YouTube video creates a session automatically. A second note on the same video in the same day adds to the existing session. Navigating to a different video ends the first session and creates a new one. Closing and reopening the browser marks abandoned sessions as completed. The session header shows the correct title, elapsed time, and note count. Returning to a video within two hours shows the continuation prompt.

---

## Phase 7 — Notes manager, search, and annotation

### Goal

Full notes management across all notebooks and sessions, working search, and an annotation canvas on captured screenshots.

### Prerequisites

Phases 1 through 6 complete.

### Step 1 — Build the notes manager panel

The manager panel renders when the user switches to the All Notes tab. It has two sub-views toggled by a secondary tab row: Notebooks view and Sessions view.

In Notebooks view, notes are grouped by notebook. Each notebook group has a header showing the notebook name with a rename button and a delete button. Below the header, note cards render in a TanStack Virtual list. The note cards in this view are the same component as in the session timeline but without the session header context.

In Sessions view, sessions are grouped by week. Each session shows its title, date, video title as a link, and note count. Expanding a session shows its note cards.

Both views use live queries so they update automatically when notes are added or changed elsewhere.

The search input at the top of the manager panel is a controlled input. Its value is stored in local component state — not Zustand, since it is purely local to this panel. As the user types, the search function is called with a 150 millisecond debounce. The results replace the grouped view with a flat list of matching note cards sorted by relevance.

### Step 2 — Implement notebook operations in the UI

Rename notebook: clicking the rename button on a notebook header opens a shadcn/ui Dialog with a text input pre-filled with the current name. Confirming calls the rename notebook Dexie operation which updates the notebook record and all its notes in a single transaction. The live query refreshes the view.

Delete notebook: clicking delete opens a confirmation Dialog. The message explains that all notes in the notebook will also be deleted. Confirming calls the soft-delete operation for every note in the notebook and then deletes the notebook record.

Create notebook: a button at the bottom of the Notebooks view or in the header opens a Dialog with a name input. Confirming creates a new notebook record in Dexie and selects it in the session header's notebook selector.

### Step 3 — Implement note edit in the manager

Clicking the edit button on a note card in the manager opens a full edit dialog. The dialog contains the same title input and body textarea as the editor. It pre-fills both from the note object. It has Save and Cancel buttons.

Saving calls the update note text content Dexie operation which increments the version counter, updates last-modified, updates the search index, and clears the export cache reference — all in one transaction. The note's sync status is set to pending-sync. A sync queue entry is added. The dialog closes and the live query updates the card in the list.

### Step 4 — Build the annotation canvas

The annotation canvas appears inside the note detail view — the view that opens when a user clicks on a note card to expand it. The note detail view shows the full screenshot with the annotation canvas overlaid on top.

Loading the note detail view: fetch the Tier 3 full screenshot blob from Dexie. Create a Blob URL. Display the image. Create an HTML canvas element sized to the same dimensions as the displayed image. Overlay the canvas absolutely on top of the image.

Rendering existing annotations: iterate the note's annotation array. For each annotation that is not soft-deleted, render it to the canvas. Freehand strokes are drawn as bezier curves through the normalised points, scaled to canvas pixel coordinates. Rectangles and circles are drawn as strokes. Text labels are drawn with fillText. Highlights are drawn as semi-transparent filled rectangles.

Handling new strokes: on pointerdown, start a new stroke. Record the starting position normalised to canvas dimensions. On pointermove, add each new normalised point to the in-progress stroke. Draw the in-progress stroke on the canvas in real time. On pointerup, finalise the stroke. Create a new annotation object with a UUID, type freehand, and the normalised point array. Add it to the note's annotation array via the update annotation array Dexie operation. This operation increments the version counter and enqueues a sync operation.

The annotation toolbar floats below the canvas. It has: a color picker with six preset colors, a stroke thickness slider, a highlight mode toggle, a text label mode button, a shape mode toggle for rectangle and circle, an eraser mode button, an undo button, and a close button.

Undo: maintain an in-memory undo stack in component state — an array of annotation array snapshots. Each completed stroke pushes a snapshot. The undo button pops the last snapshot and calls the update annotation array Dexie operation with the popped state.

When the note detail view unmounts: revoke the image Blob URL, cancel any pending animation frames, remove all canvas event listeners.

### Step 5 — Test annotation persistence

Draw a freehand stroke on a captured screenshot. Close the note. Reopen it. Verify the stroke reappears correctly. Verify the stroke renders at the correct position regardless of what size the canvas is displayed at — shrink the sidebar, reopen the note, confirm the stroke is in the right place.

Undo a stroke. Verify the stroke disappears from the canvas and from the Dexie annotation array. Undo again with an empty stack — verify nothing crashes.

### Phase 7 verification checklist

Manager panel shows all notes grouped by notebook. Sessions view shows sessions grouped by week. Search returns correct results. Notebook rename updates all notes. Note edit saves correctly and increments version counter. Annotation canvas renders existing annotations. New strokes are drawn, stored as normalised vectors, and persist after close and reopen. Undo works. Canvas Blob URL is revoked on unmount confirmed via memory profiling.

---

## Phase 8 — Service worker and sync engine

### Goal

A robust background sync engine that processes the sync queue, retries failures with backoff, and survives worker suspension and browser restart.

### Prerequisites

Phases 1 through 7 complete. No backend is needed for this phase — the sync engine is tested in isolation first.

### Step 1 — Register alarms

In the service worker install and startup handlers, register two Chrome alarms. The sync alarm has a period of one minute. The cleanup alarm has a period of 1440 minutes — 24 hours. Before creating each alarm, check whether it already exists using the Chrome alarms API get method. Only create it if it does not exist. Log all alarm creation and skip events clearly for debugging.

### Step 2 — Implement the sync queue processor

Write the sync queue processor function. It reads all sync queue entries from Dexie where the next retry timestamp is earlier than now and the status is not error. This gives the set of due operations.

For each due operation, it calls the try sync function. The try sync function checks whether the target provider is registered and connected — connected means an auth token exists in storage for that provider. If not connected, skip this entry — do not increment the retry count. The provider might simply not be set up yet.

If connected, call the provider's push method with the note data. On success, delete the queue entry from Dexie and update the note's sync status to synced in the same transaction.

On failure, increment the retry count. Calculate the next retry timestamp using the formula: current time plus two to the power of retry count in minutes, capped at 60 minutes. So first retry is 1 minute later, second is 2 minutes, third is 4, up to 60. Write the updated entry back to Dexie.

If the retry count exceeds 10, set the entry status to error. Do not delete it. Log it. The sync error count in preferences is incremented.

After processing all due entries, run the pull step: for each connected provider, call its pull method with the last-pull timestamp for that provider. Process returned notes by writing them to Dexie if the remote version counter is higher than the local version counter. If both have been modified — both version counters are higher than the known-synced version — write the remote version as a conflict copy and set the local note status to conflict. Update the last-pull timestamp for the provider to now.

### Step 3 — Connect the processor to the alarm

The alarm listener in the service worker calls the sync queue processor when the sync alarm fires. This is a single async call. The processor is awaited. If it throws, log the error — do not let an unhandled rejection terminate the service worker.

### Step 4 — Connect the cleanup alarm

The cleanup alarm calls the weekly cleanup function from Phase 1: delete expired export cache entries, run orphaned screenshot cleanup, run storage quota monitoring, and if above 80 percent, clear Tier 3 data for old synced notes.

### Step 5 — Implement startup sync recovery

The startup handler, after re-registering alarms, queries the sync queue for any entries that exist. If any exist, it immediately calls the sync queue processor rather than waiting for the next alarm tick. This ensures notes queued before browser shutdown sync as soon as the browser opens.

### Step 6 — Test sync engine in isolation

Write a mock sync provider that records calls and can be configured to succeed or fail. Register it in the provider registry. Create notes in Dexie and add sync queue entries pointing to the mock provider. Trigger the sync processor manually. Verify that: successful operations delete their queue entry and update note sync status, failed operations increment retry count and set next retry timestamp, operations failing more than 10 times get error status, pull operations write remote notes to Dexie, conflicts are written as conflict copies.

Simulate worker suspension by unregistering the alarm listener and calling it again after clearing all in-memory state. Verify the processor reads fresh from Dexie with no in-memory assumptions.

### Phase 8 verification checklist

Both alarms are registered on install and startup. Alarm firing triggers the processor. Successful sync deletes queue entries and updates note status. Failed sync retries with correct backoff timestamps. Error status applied after 10 failures. Pull correctly handles remote-only notes and conflicts. Startup handler triggers immediate sync when queue has entries. Worker can be simulated suspended and resumed with no state loss.

---

## Phase 9 — FastAPI backend and backend sync provider

### Goal

A production-ready FastAPI backend and the implementation of the backend sync provider in the extension.

### Prerequisites

Phase 8 complete with mock provider tested.

### Step 1 — Set up the FastAPI project

In the backend workspace, create a Python virtual environment. Install FastAPI, Uvicorn, SQLAlchemy with async support, aiosqlite, Pydantic, python-jose for JWT, passlib for password hashing, python-multipart for file uploads, WeasyPrint, and python-dotenv.

Configure the project to read all sensitive values — JWT secret, allowed CORS origins, storage path — from environment variables loaded from a .env file. Never hardcode these values.

### Step 2 — Define the database schema

Define the SQLAlchemy models. The notes model has all fields from the note project structure except image blobs — those are stored as files. It adds an owner user ID column. All timestamps are stored as strings in ISO 8601 format to match the frontend. The model mirrors the Dexie schema so that pushing and pulling between the extension and backend requires no field transformation.

The users model has a UUID primary key, an email address, a hashed password string, a created-at timestamp, and a boolean pro flag for the future Pro tier gate.

Define the database initialisation function. It creates all tables if they do not exist on startup. Use an async engine with aiosqlite.

### Step 3 — Implement authentication

Write the login endpoint. It accepts email and password, validates the password against the stored hash, and returns a JWT access token. The token payload contains the user UUID. Token expiry is 7 days.

Write the register endpoint. It accepts email and password, hashes the password using bcrypt, creates a user record, and returns a JWT access token.

Write a dependency function that extracts and validates the JWT from the Authorization header. Every protected endpoint uses this dependency.

### Step 4 — Implement note endpoints

Write the batch push endpoint. It accepts an array of note objects. For each note, it upserts the record — insert if the UUID does not exist, update if it does and the incoming version counter is higher than the stored one. If the incoming version counter equals or is lower than the stored one, skip the update and return the stored note in the response. This is the conflict signal — the extension handles it on the receiving end. The endpoint returns an array of all processed notes with their current server state.

Write the batch pull endpoint. It accepts a since timestamp parameter. It returns all notes for the authenticated user where last-modified is after that timestamp, where deleted is false. It also returns deleted notes modified after the timestamp so the extension can propagate deletions.

Write the screenshot upload endpoint. It accepts the note UUID and a file upload. It saves the file to the screenshots directory with the UUID as the filename. It does not modify the note record — screenshot upload is tracked separately.

Write the screenshot serve endpoint. It accepts the note UUID, validates the UUID format, constructs the path, and returns the file if it exists. It checks that the requesting user owns the note before serving.

Write the batch delete endpoint. It accepts an array of note UUIDs and soft-deletes them — sets deleted to true and updates last-modified.

Write the notebook endpoints: list all notebooks for the user, rename a notebook across all its notes.

Write the PDF export endpoint. It accepts a notebook UUID or video URL filter. It fetches all matching notes. For each note with a screenshot file, it reads the file and base64-encodes it for inline embedding in the HTML. It assembles an HTML string with the note content, using inline styles only — no external stylesheets since WeasyPrint needs everything inline. It calls WeasyPrint to render the HTML to a PDF. It returns the PDF as a file response with the filename set to the notebook name or video title.

### Step 5 — Implement the backend sync provider in the extension

In the extension workspace, implement the backend sync provider class. It implements the sync provider interface from Phase 8.

The check connectivity method makes a lightweight GET request to a health endpoint on the backend. If it returns 200, the provider is reachable. If it throws or returns any other status, the provider is unreachable.

The push method takes a note object, sends it to the batch push endpoint as a one-item array, and returns the response. After a successful metadata push, it checks whether the note has a screenshot key in its screenshot data. If yes, it reads the Tier 3 blob from Dexie and uploads it to the screenshot upload endpoint as a multipart form.

The pull method takes a since timestamp, calls the batch pull endpoint, and returns the array of note objects.

The delete method sends the note UUID to the batch delete endpoint.

Register the backend sync provider with the sync engine. The provider is connected when a JWT token exists in extension storage. The provider is disconnected when no token exists.

### Step 6 — Test the full sync round-trip

Run the backend locally. In the extension, log in using the backend credentials. Create a note. Verify that within one minute — the alarm period — the note appears in the backend's notes table. Verify the screenshot file is present in the backend storage directory. Modify the note. Verify the updated version is pushed. Delete the note. Verify the deleted flag is set on the backend. Pull from the backend — create a note directly in the backend database and verify it appears in the extension's Dexie within one minute of the alarm firing.

### Phase 9 verification checklist

Login returns a JWT token. Batch push upserts notes correctly. Pull returns notes after the since timestamp. Screenshot upload stores the file. Screenshot serve returns the file to the correct user only. Notebook rename propagates. PDF export returns a valid PDF with images and styled text. The backend sync provider in the extension pushes notes on the next alarm tick after creation. Screenshot uploads separately after metadata sync. Conflict detection works when the same note is modified on both sides.

---

## Phase 10 — Export

### Goal

Four complete export formats, all working without backend dependency except PDF.

### Prerequisites

Phase 9 complete.

### Step 1 — Project JSON export

Write the export function that assembles a full project JSON object for a given set of notes. For each note, read its Tier 1 metadata, its Tier 3 full screenshot blob, its thumbnail blob, and its annotation array. Convert both blobs to base64 strings using FileReader. Assemble the note project structure with the base64 data inline. Wrap the array of note project objects in a top-level export envelope containing a schema version field, an export timestamp, and the array. Return the JSON string.

Trigger a download using a temporary anchor element with a Blob URL. Revoke the Blob URL immediately after the click is triggered.

### Step 2 — Markdown export

Write the markdown generator. For a given set of notes, group them by video title. For each group, emit the video title as a top-level heading. For each note in the group, emit the timestamp as a heading-level link — the link points to the video URL at the correct second. Below the timestamp, emit the note title as a sub-heading if present. Below that, emit the note body text. Add a horizontal rule between notes.

The markdown generator returns a string and a list of image references. Each image reference is a note UUID paired with a filename of the form that the markdown references. The caller is responsible for including the actual image files alongside the markdown — this happens in the ZIP export.

### Step 3 — ZIP export

Write the ZIP assembler using fflate. For a given notebook or set of notes, it assembles a ZIP archive in memory. The archive contains: the project JSON string, the markdown string, one PNG file per note that has a screenshot named by UUID, one JSON file per note's annotation array named by UUID and suffixed with -annotations, and a readme text file.

Building the archive: create an fflate zip object. Add the project JSON and markdown as text entries. For each note UUID, read the Tier 3 blob from Dexie and convert it to a Uint8Array. Add it to the zip. Read the annotation array from the note object, serialise it to JSON, and add it as a text entry. After all entries are added, call fflate's zip function with a callback that provides the finished ZIP as a Uint8Array. Convert to a Blob and trigger a download.

### Step 4 — PDF export via backend

Write the PDF export UI action. It shows a loading spinner in the export button while the request is in progress. It sends the note metadata, annotation arrays, and screenshot blobs to the backend PDF export endpoint as a POST request with a JSON body. The screenshots are sent as base64 strings. The backend renders and returns the PDF. The extension receives the response as a blob and triggers a download.

If the backend is unreachable, show an error message explaining that PDF export requires a connection to the backend. Offer the ZIP export as an offline alternative.

### Step 5 — Import with validation

Write the import function. It accepts a project JSON string. It parses the JSON. It validates the top-level schema version field — if the version is higher than the current known version, warn the user that this file was exported from a newer version and some data may not import correctly.

For each note in the array, run the validation function defined in Phase 1. If a required field is missing and has no safe default, record the note UUID in the failed list and skip it. If a field is missing but has a safe default, apply the default and record a warning. After validation, write the valid notes to Dexie in a batch. Show a summary modal with counts of successful imports, warnings, and failures. Failed notes are listed with the specific validation error for each.

### Phase 10 verification checklist

Project JSON exports a valid parseable file containing all note data and base64 images. Markdown export produces correct heading structure with correct timestamp links. ZIP export contains all expected files with correct names. ZIP can be opened in a standard archive tool and all files are readable. PDF export returns a styled PDF from the backend with images. PDF export shows a useful error message when offline. Import with a valid file writes all notes to Dexie. Import with a malformed file shows errors for failed notes without crashing.

---

## Phase 11 — Google Drive sync provider

### Goal

An optional Pro sync provider that stores raw note project files in a private Drive app folder.

### Prerequisites

Phase 9 complete. A Google Cloud Console project with the Drive API enabled and OAuth credentials configured.

### Step 1 — Set up OAuth credentials

In Google Cloud Console, create OAuth 2.0 credentials for a Chrome extension. The application type is Chrome App. Add the extension ID. Enable the Google Drive API. Request only the drive.appdata scope.

Store the client ID in the extension's environment configuration. Never store the client secret — Chrome extension OAuth does not use a client secret.

### Step 2 — Implement the OAuth flow

Write the connect Drive function. It calls the Chrome identity API to initiate an OAuth flow with the drive.appdata scope. On success, receive the access token. Request the refresh token by including the access type offline parameter. Store both tokens in extension storage using WXT's typed storage API.

Write the token refresh function. Before every Drive API call, check the token expiry time stored alongside the access token. If the token has expired or will expire within 5 minutes, call the token refresh endpoint with the refresh token. Store the new access token and expiry.

Write the disconnect Drive function. It removes the tokens from extension storage and sets the provider as disconnected in the Zustand store.

### Step 3 — Implement the Drive provider

Write the Drive provider class implementing the sync provider interface.

The check connectivity method attempts a lightweight call to the Drive API — listing the app data folder contents with a max results of one. If it succeeds, the provider is reachable. If it fails with a 401, the token has expired and refresh is needed. If it fails with a network error, the provider is unreachable.

The push method works in steps for each note. First, check whether a folder named with the note UUID already exists in the app data folder. If not, create it. Then push four files into the folder: the metadata JSON file containing all Tier 1 fields, the annotation JSON file, the full screenshot PNG, and the thumbnail PNG. Each file upload uses the Drive multipart upload API with the file content and a metadata block specifying the parent folder and the filename. For each file upload, include the If-Match header with the current etag if updating an existing file. A 412 response triggers conflict handling.

The pull method lists all folders in the app data folder. For each folder, it reads the metadata JSON file and parses the last-modified timestamp. If the timestamp is after the since parameter, download all four files for that note and assemble a note project object. Return the array.

The delete method moves the note's folder to the Drive trash using the Drive files update API. Actual deletion from trash happens on Google's schedule.

### Step 4 — Connect the OAuth flow to the UI

In the popup or in a settings panel accessible from the sidebar header, add a Connect Google Drive button. Clicking it calls the connect Drive function. On success, the button changes to a Connected indicator showing the user's Google account name. A disconnect button appears. Connecting updates the Zustand store's connected providers list, which the sync engine reads on every alarm tick.

### Step 5 — Test Drive sync end to end

Connect Drive in the extension. Create a note. Wait for the sync alarm to fire. Open Google Drive on the web, navigate to the app data folder — it is hidden from normal Drive view but accessible via the Drive API Explorer. Verify the note folder exists with the four expected files. Read the metadata JSON and verify it matches the local Dexie record. Modify the note locally. Wait for the alarm. Verify the Drive metadata JSON is updated with the new version counter and last-modified timestamp.

Test conflict: manually edit the Drive metadata JSON via the API Explorer to increment the version counter. Trigger a pull. Verify the extension writes the remote version as a conflict copy and marks the local note as conflict. Verify the conflict indicator appears on the note card.

### Phase 11 verification checklist

OAuth flow completes and stores tokens. Token refresh works before expiry. Drive folder structure is created on first push. All four files are present in the folder. Pull correctly reads and assembles note objects. Conflict via etag mismatch triggers conflict copy. Disconnect removes tokens and disables the provider.

---

## Phase 12 — Web app and iPad annotation

### Goal

A standalone web application installable as a PWA on iPad that shows all notes, supports full annotation editing with Apple Pencil, and pushes annotations back to the backend.

### Prerequisites

Phase 9 complete — the backend is the data source for the web app.

### Step 1 — Set up the web app project

Create the web app workspace. Initialise it with Vite, React, TypeScript, and Tailwind CSS. Install shadcn/ui. Install React Query. Add the shared types package as a workspace dependency.

The web app has no connection to Dexie or IndexedDB. It reads from and writes to the FastAPI backend exclusively. The backend is its source of truth.

Configure the PWA plugin for Vite — vite-plugin-pwa. Set the display mode to standalone so it appears without browser chrome when installed. Set the orientation to portrait on mobile and any on desktop. Configure the start URL and icon.

### Step 2 — Build authentication

Build a login page with email and password inputs. On submit, call the backend login endpoint. On success, store the JWT in memory — not localStorage, not sessionStorage. Use React Query's query client cache as the in-memory store for the token. The token persists only for the browser session. On page load with no token, redirect to login.

The token is attached to every API request via a request interceptor in a shared fetch wrapper function. The wrapper takes the URL, method, and body, prepends the backend base URL, and adds the Authorization header.

### Step 3 — Build the notebook list and note feed

The notebook list sidebar shows all notebooks for the authenticated user. On desktop, it is a persistent left sidebar. On tablet, it is a slide-in drawer opened by a menu button. Use a React Query query that fetches notebooks from the backend.

Selecting a notebook shows the note feed for that notebook. The note feed uses TanStack Virtual for virtualised rendering. Each card shows the thumbnail — loaded from the backend screenshot serve endpoint — the note title, the timestamp as a link, and the note body text. Thumbnails are loaded lazily when the card scrolls into view.

The note feed has a search input that calls the backend search endpoint with a debounce.

Clicking a note card opens the note detail view.

### Step 4 — Build the note detail view

The note detail view shows the full screenshot loaded from the backend with the annotation canvas overlaid. It also shows the note text, title, and metadata below the canvas.

The annotation canvas on the web app uses the same normalised coordinate system as the extension. On load, it reads the note's annotation array from the backend and renders all annotations onto the canvas. The rendering logic is identical to the extension's — this should be a shared utility function imported from the shared package.

Add the annotation toolbar below the canvas with the same controls as the extension: color, thickness, eraser, text label, shapes, undo, and save.

### Step 5 — Implement annotation on iPad with Pencil support

All canvas interactions use pointer events. Set touch-action to none on the canvas element to prevent the browser from handling touch events as scroll or zoom.

Implement palm rejection. Maintain a rolling window of the last 10 pointer events. If any event in the window has pointerType pen, activate pen-primary mode. In pen-primary mode, ignore all events with pointerType touch — these are palm contacts. If no pen events appear for 2 seconds, deactivate pen-primary mode.

Implement pinch-to-zoom. Track two simultaneous touch pointers. When two touches are active simultaneously, calculate the distance between them. If the distance changes by more than 10 pixels, treat it as a pinch gesture — scale the canvas view rather than drawing. Apply the scale transform to the canvas container, not to the canvas element itself. Keep the canvas at its original pixel size so drawing coordinates remain accurate. When the pinch ends, record the current scale and offset.

Stroke rendering during a pinch must be suppressed — ignore pen events while two touch events are active.

Implement stroke smoothing. Raw pointer event coordinates produce jagged strokes at low speeds. Apply a simple moving average smoothing to the last 4 points before rendering. Store the unsmoothed coordinates in the annotation data so the original input is preserved.

### Step 6 — Implement annotation save

When the user taps the save button on the annotation toolbar, send the updated annotation array to the backend edit endpoint. The backend updates the note record and increments the version counter. The extension's sync engine will pull this update on the next alarm tick and update the local Dexie record. The user sees their iPad annotations appear in the extension on their next alarm tick.

### Step 7 — Build the PWA manifest and install prompt

Configure the Vite PWA plugin with a name, short name, description, icons in multiple sizes, and theme colour. Set the display to standalone. Add a service worker that caches the app shell — HTML, CSS, JavaScript — so the web app loads offline. Note data is not cached offline in the web app — it always requires a backend connection.

On iOS Safari, the install prompt must be manual — iOS does not support the beforeinstallprompt event. Show a persistent banner at the top of the login page explaining how to install: tap the Share button in Safari and choose Add to Home Screen.

### Phase 12 verification checklist

Web app loads in Safari on iPad. Login works and stores token in memory. Notebook list and note feed load from backend. Thumbnails load lazily. Note detail shows the full screenshot with annotation overlay. Drawing with Apple Pencil creates strokes. Palm rejection works — heel of hand does not create strokes during Pencil use. Pinch-to-zoom scales the view without drawing. Saving annotations sends the updated array to the backend. Extension pulls the updated annotation on next alarm tick and shows it. PWA installs to iPad home screen and opens without browser chrome.

---

## Cross-cutting concerns to verify after every phase

After completing each phase, verify that these global constraints still hold:

TypeScript strict mode compiles with zero errors. No any types have been introduced. The shared types package has not been modified in a way that breaks the extension or web app imports.

No component manipulates the DOM directly. No component calls sync provider APIs. No Blob URL has been created without a corresponding revoke path.

The Dexie schema version is correct. If a schema change was needed, the migration function is present and has been tested.

No permission has been added to the manifest without justification. The permissions list is reviewed before every phase commit.

Memory profiling in Chrome DevTools shows no growing heap after repeated note creation, deletion, and annotation on a long-running session. Run the profiler for 10 minutes of active use and confirm the heap is stable.

The extension still loads without errors on YouTube, on a generic HTML5 video page, and on a DRM-protected page.

---

## Common failure modes and how to handle them

**Shadow DOM styles not applying.** The most common cause is Tailwind's CSS being injected into the document head instead of the shadow root. Verify the WXT content script configuration specifies shadow DOM mode and that the Tailwind plugin is configured to inject into it. The quick verification is to inspect the shadow root in DevTools and confirm a style element is present inside it.

**Dexie transaction failures.** The most common cause is calling an async function that itself opens a transaction inside an existing Dexie transaction. Dexie does not support nested transactions. Restructure the code so that all operations in a transaction are passed as operations to Dexie's transaction method, not as separate awaited calls.

**Service worker suspension during a batch sync.** This is expected behaviour. The design handles it through Dexie checkpointing. If you see partial syncs, verify that each successful note sync deletes its queue entry immediately rather than at batch end.

**YouTube player not found.** YouTube changes its DOM structure periodically. The selector in the YouTube platform implementation needs updating. Make the selector a clearly named constant and update it. Add a fallback to the generic video element finder.

**Canvas drawImage throws SecurityError.** The video element is cross-origin. The frame extraction fails. This is the trigger for tab capture fallback. Verify the error catch clause is present and calls the fallback correctly.

**Dexie migration fails on user's device.** The migration threw during an upgrade. The user is stuck on an older schema version. The error handler must show a data export option. After export, the user can clear extension data and reimport. The clear extension data option must be accessible even when the database is in a broken state — it must not require a working Dexie connection.

**Google Drive 403 on push.** The access token has expired. The token refresh logic has a bug or the refresh token has been revoked. Show a re-authentication prompt. Do not silently fail — the user needs to know their Drive sync is not working.

**iPad annotation canvas scroll conflict.** The canvas element needs touch-action none. If the page scrolls while drawing, this attribute is missing or overridden by a parent element. Verify touch-action none is applied to the canvas and that no parent element overrides it.
