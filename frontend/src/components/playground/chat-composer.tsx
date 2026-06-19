"use client";

import { useRef } from "react";
import { Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".docx"];

function isAllowed(file: File) {
  const lower = file.name.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

interface ChatComposerProps {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  isSending: boolean;
  pendingFiles: File[];
  setPendingFiles: (files: File[]) => void;
}

export function ChatComposer({
  input,
  setInput,
  onSend,
  isSending,
  pendingFiles,
  setPendingFiles,
}: ChatComposerProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList) => {
    const valid = Array.from(files).filter(isAllowed);

    setPendingFiles([...pendingFiles, ...valid]);
  };

  const removeFile = (index: number) => {
    const updated = [...pendingFiles];
    updated.splice(index, 1);
    setPendingFiles(updated);
  };

  return (
    <div className="border-t p-4">

      {/* file chips */}

      {pendingFiles.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {pendingFiles.map((file, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="gap-2"
            >
              {file.name}

              <button
                onClick={() => removeFile(index)}
              >
                <X size={14}/>
              </button>

            </Badge>
          ))}
        </div>
      )}

      {/* input */}

      <div className="flex items-end gap-2 rounded-2xl border p-3">

        <Textarea
          value={input}
          onChange={(e)=>setInput(e.target.value)}
          placeholder="Enter prompt..."
          className="flex-1 resize-none border-0 shadow-none"
          onKeyDown={(e)=>{
            if(e.key==="Enter" && !e.shiftKey){
              e.preventDefault();
              onSend();
            }
          }}
        />

        <input
          hidden
          multiple
          type="file"
          ref={fileRef}
          accept=".pdf,.txt,.docx"
          onChange={(e)=>{
            if(e.target.files){
              addFiles(e.target.files);
            }
          }}
        />

        <Button
          variant="ghost"
          onClick={()=>fileRef.current?.click()}
        >
          <Paperclip size={18}/>
        </Button>

        <Button
          disabled={isSending}
          onClick={()=>onSend()}
        >
          <Send size={18}/>
        </Button>

      </div>

    </div>
  );
}