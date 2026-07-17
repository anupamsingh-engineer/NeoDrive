import { Modal } from "../../../../components/ui";

const VideoPreviewModal = ({ file, src, onClose }) => (
  <Modal open={!!file} onClose={onClose} title={file?.name} size="xl">
    {file && <video controls autoPlay className="max-h-[70vh] w-full rounded-sm bg-ink" src={src} />}
  </Modal>
);

export default VideoPreviewModal;
