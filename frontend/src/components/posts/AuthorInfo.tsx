"use client";

import { Avatar } from '@/components/ui/avatar';
import { Post } from '@/types';

interface AuthorInfoProps {
  author?: Post['author'];
}

export default function AuthorInfo({ author }: AuthorInfoProps) {
  if (!author) return null;
  
  return (
    <div className="mt-12 p-6 bg-gray-50 rounded-lg">
      <div className="flex items-start space-x-4">
        <Avatar 
          src={author.profileImage} 
          alt={author.username || 'Author'}
          fallback={author.username || 'Author'}
          size="lg"
          className="flex-shrink-0"
        />
        <div className="flex-1">
          <h3 className="text-xs font-medium text-gray-900 mb-1">
            {author.username || 'Author'}
          </h3>
          <p className="text-xs text-gray-600">
            {author.bio || ''}
          </p>
        </div>
      </div>
    </div>
  );
} 