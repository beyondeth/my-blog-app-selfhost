'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { FiCheck, FiX, FiLoader } from 'react-icons/fi';

/**
 * 캐릭터 선택 컴포넌트
 *
 * 사용자가 프로필 이미지로 사용할 캐릭터를 선택할 수 있는 모달/드로어 컴포넌트
 * /public/character 폴더의 19개 캐릭터 이미지를 그리드로 표시
 */

interface Character {
  name: string;
  path: string;
}

interface CharacterSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfileImage: string | null;
  onSelectCharacter: (characterPath: string) => Promise<void>;
}

export default function CharacterSelector({
  isOpen,
  onClose,
  currentProfileImage,
  onSelectCharacter,
}: CharacterSelectorProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  // 캐릭터 목록 로드
  useEffect(() => {
    if (isOpen) {
      fetchCharacters();
    }
  }, [isOpen]);

  const fetchCharacters = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/users/characters`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('캐릭터 목록을 불러오는데 실패했습니다');
      }

      const data = await response.json();
      setCharacters(data.characters || []);
    } catch (err) {
      console.error('Failed to fetch characters:', err);
      setError('캐릭터 목록을 불러올 수 없습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCharacter = async (characterPath: string) => {
    setSelectedCharacter(characterPath);
    setUpdating(true);
    setError('');

    try {
      await onSelectCharacter(characterPath);
      // 성공 시 모달 닫기 (1초 후)
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Failed to update character:', err);
      setError('프로필 이미지 변경에 실패했습니다');
      setSelectedCharacter(null);
    } finally {
      setUpdating(false);
    }
  };

  if (!isOpen) return null;

  // 현재 프로필 이미지가 캐릭터인지 확인
  const isCurrentCharacter = currentProfileImage?.startsWith('/character/');
  const currentCharacterName = isCurrentCharacter
    ? currentProfileImage?.split('/').pop()?.replace('.jpeg', '')
    : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* 모달 컨텐츠 */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-3xl bg-white dark:bg-gray-800 rounded-lg shadow-xl">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              캐릭터 선택
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              <FiX className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* 컨텐츠 */}
          <div className="px-6 py-4">
            {error && (
              <div className="mb-4 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-md">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <FiLoader className="w-8 h-8 text-gray-400 animate-spin" />
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  프로필 이미지로 사용할 캐릭터를 선택하세요 ({characters.length}개)
                </p>

                {/* 캐릭터 그리드 */}
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3 max-h-[500px] overflow-y-auto">
                  {characters.map((character) => {
                    const isSelected = selectedCharacter === character.path;
                    const isCurrent = currentCharacterName === character.name;

                    return (
                      <button
                        key={character.name}
                        onClick={() => handleSelectCharacter(character.path)}
                        disabled={updating}
                        className={`
                          relative aspect-square rounded-lg overflow-hidden
                          border-2 transition-all
                          ${isCurrent
                            ? 'border-blue-500 dark:border-blue-400'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                          }
                          ${isSelected ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''}
                          disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                        title={character.name}
                      >
                        <Image
                          src={character.path}
                          alt={character.name}
                          width={100}
                          height={100}
                          className="w-full h-full object-cover"
                          unoptimized
                        />

                        {/* 현재 사용 중 표시 */}
                        {isCurrent && (
                          <div className="absolute top-1 right-1 bg-blue-500 dark:bg-blue-400 rounded-full p-1">
                            <FiCheck className="w-3 h-3 text-white" />
                          </div>
                        )}

                        {/* 선택 중 표시 */}
                        {isSelected && updating && (
                          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                            <FiLoader className="w-6 h-6 text-white animate-spin" />
                          </div>
                        )}

                        {/* 캐릭터 이름 */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1">
                          <p className="text-xs text-white text-center truncate">
                            {character.name}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* 푸터 */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              disabled={updating}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
