import { fileIconFor } from "./extensionMap";

const FileTypeIcon = ({ extension, className = "h-5 w-5" }) => {
  const Icon = fileIconFor(extension);
  return <Icon className={className} aria-hidden="true" />;
};

export default FileTypeIcon;
