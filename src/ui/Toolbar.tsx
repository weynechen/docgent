import type { Editor } from "@tiptap/react";

interface ToolbarProps {
  editor: Editor | null;
  onRewrite: () => void;
}

function ToolButton({
  isActive,
  onClick,
  children,
}: {
  isActive?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      className={`tool-button${isActive ? " active" : ""}`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export function Toolbar({ editor, onRewrite }: ToolbarProps) {
  if (!editor) {
    return null;
  }

  return (
    <div className="toolbar floating">
      <ToolButton
        isActive={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        B
      </ToolButton>
      <ToolButton
        isActive={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        I
      </ToolButton>
      <ToolButton
        isActive={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        List
      </ToolButton>
      <span className="toolbar-divider" />
      <ToolButton onClick={() => editor.chain().focus().undo().run()}>Undo</ToolButton>
      <ToolButton onClick={() => editor.chain().focus().redo().run()}>Redo</ToolButton>
      <ToolButton onClick={onRewrite}>AI</ToolButton>
    </div>
  );
}
