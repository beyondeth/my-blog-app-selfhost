"use client";

import { ReactNode, useEffect, useState } from "react";
import { Github } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface GithubResourcePopoverProps {
  githubUrl: string;
  githubDescription: string;
  onGithubUrlChange: (value: string) => void;
  onGithubDescriptionChange: (value: string) => void;
  children: ReactNode;
}

export default function GithubResourcePopover({
  githubUrl,
  githubDescription,
  onGithubUrlChange,
  onGithubDescriptionChange,
  children,
}: GithubResourcePopoverProps) {
  const [open, setOpen] = useState(false);
  const [draftUrl, setDraftUrl] = useState(githubUrl);
  const [draftDescription, setDraftDescription] = useState(githubDescription);

  useEffect(() => {
    if (!open) {
      setDraftUrl(githubUrl);
      setDraftDescription(githubDescription);
    }
  }, [githubDescription, githubUrl, open]);

  const handleCancel = () => {
    setDraftUrl(githubUrl);
    setDraftDescription(githubDescription);
    setOpen(false);
  };

  const handleSave = () => {
    onGithubUrlChange(draftUrl);
    onGithubDescriptionChange(draftDescription);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            <Github className="h-4 w-4" />
            <span>GitHub resource</span>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Add the GitHub URL and description you want to share.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="github-resource-url" className="text-xs font-medium">
            URL
          </Label>
          <Input
            id="github-resource-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            value={draftUrl}
            onChange={(event) => setDraftUrl(event.target.value)}
            placeholder="https://github.com/your-org/your-repo"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="github-resource-description" className="text-xs font-medium">
            Description
          </Label>
          <Textarea
            id="github-resource-description"
            value={draftDescription}
            onChange={(event) => setDraftDescription(event.target.value)}
            placeholder="Example: Readers can download the sample code from this post here."
            rows={3}
            className="resize-none"
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleSave}>
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
