import { useEffect, useRef, useState } from 'react';
import { imageUrl, type ImageId, type NoteId, type NoteImage } from '../model/note';
import { useNoteActions } from '../state/useNotes';
import styles from './NoteImages.module.css';

interface NoteImagesProps {
  noteId: NoteId;
  images: readonly NoteImage[];
}

interface LightboxProps {
  image: NoteImage;
  onClose: () => void;
  onRemove: () => void;
}

/**
 * A modal dialog renders in the top layer, which is the only way out of the transformed
 * board: anything else would be scaled and offset along with the note it belongs to.
 */
function Lightbox({ image, onClose, onRemove }: LightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null || dialog.open) return;
    dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={styles.lightbox}
      aria-label="Image"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
    >
      <img className={styles.full} src={imageUrl(image.id)} alt="" />
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.action}
          data-danger=""
          onClick={() => {
            onRemove();
            dialogRef.current?.close();
          }}
        >
          Remove
        </button>
        <button type="button" className={styles.action} onClick={() => dialogRef.current?.close()}>
          Close
        </button>
      </div>
    </dialog>
  );
}

export function NoteImages({ noteId, images }: NoteImagesProps) {
  const actions = useNoteActions();
  const fileRef = useRef<HTMLInputElement>(null);
  const [openId, setOpenId] = useState<ImageId | null>(null);

  const open = images.find((image) => image.id === openId) ?? null;

  return (
    <div className={styles.images} onPointerDown={(event) => event.stopPropagation()}>
      {images.map((image) => (
        <button
          key={image.id}
          type="button"
          className={styles.thumb}
          aria-label="Open image"
          onClick={() => setOpenId(image.id)}
        >
          <img src={imageUrl(image.id)} alt="" loading="lazy" draggable={false} />
        </button>
      ))}

      <button
        type="button"
        className={styles.add}
        aria-label="Add an image"
        title="Add an image"
        onClick={() => fileRef.current?.click()}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      <input
        ref={fileRef}
        className={styles.file}
        type="file"
        accept="image/*"
        multiple
        tabIndex={-1}
        onChange={(event) => {
          for (const file of event.target.files ?? []) actions.attachImage(noteId, file);
          event.target.value = '';
        }}
      />

      {open !== null && (
        <Lightbox
          image={open}
          onClose={() => setOpenId(null)}
          onRemove={() => actions.detachImage(noteId, open.id)}
        />
      )}
    </div>
  );
}
