import { useRef } from "react";
import { FolderPlus, Upload as UploadIcon, Download, List, LayoutGrid } from "lucide-react";
import { Button, SegmentedControl } from "../../../../components/ui";

const Toolbar = ({ viewMode, onViewModeChange, onNewFolder, onUploadFiles, onDownloadFolder }) => {
  const inputRef = useRef(null);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <SegmentedControl
        value={viewMode}
        onChange={onViewModeChange}
        options={[
          { value: "list", icon: List, label: "List" },
          { value: "grid", icon: LayoutGrid, label: "Tiles" },
        ]}
      />
      <div className="flex items-center gap-2">
        <Button variant="secondary" icon={Download} onClick={onDownloadFolder} title="Download this folder as a zip">
          Download
        </Button>
        <Button variant="secondary" icon={FolderPlus} onClick={onNewFolder}>
          New Folder
        </Button>
        <Button variant="primary" icon={UploadIcon} onClick={() => inputRef.current?.click()}>
          Upload File
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) onUploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
};

export default Toolbar;
