'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Settings,
  Shield,
  Bell,
  Globe,
  Database,
  Mail,
  Lock,
  Palette,
  Activity,
  AlertTriangle,
  Save,
  RefreshCw,
  HardDrive,
  Users,
  FileText,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSystemSettings, useUpdateSystemSettings } from '@/hooks/useAdmin';
import { t } from '@/constants/adminTranslations';

interface SystemSettings {
  general: {
    siteName: string;
    siteDescription: string;
    siteUrl: string;
    contactEmail: string;
    timeZone: string;
    dateFormat: string;
    maintenanceMode: boolean;
    maintenanceMessage?: string;
  };
  content: {
    postsPerPage: number;
    commentsPerPage: number;
    maxUploadSize: number;
    allowedFileTypes: string[];
    enableComments: boolean;
    requireCommentModeration: boolean;
    enableLikes: boolean;
    enableSharing: boolean;
  };
  security: {
    requireEmailVerification: boolean;
    passwordMinLength: number;
    passwordRequireUppercase: boolean;
    passwordRequireNumbers: boolean;
    passwordRequireSpecialChars: boolean;
    maxLoginAttempts: number;
    lockoutDuration: number;
    enableTwoFactor: boolean;
    sessionTimeout: number;
  };
  email: {
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    smtpPassword?: string;
    fromEmail: string;
    fromName: string;
    emailTemplates: {
      welcome: boolean;
      passwordReset: boolean;
      emailVerification: boolean;
      newComment: boolean;
      newReport: boolean;
    };
  };
  notifications: {
    emailNotifications: boolean;
    pushNotifications: boolean;
    adminAlerts: {
      newUser: boolean;
      newReport: boolean;
      systemError: boolean;
      lowDiskSpace: boolean;
      highTraffic: boolean;
    };
    userNotifications: {
      newComment: boolean;
      newLike: boolean;
      newFollower: boolean;
      postPublished: boolean;
    };
  };
  appearance: {
    theme: 'light' | 'dark' | 'auto';
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    logoUrl?: string;
    faviconUrl?: string;
    customCss?: string;
    enableDarkMode: boolean;
  };
  performance: {
    enableCache: boolean;
    cacheDuration: number;
    enableCdn: boolean;
    cdnUrl?: string;
    enableCompression: boolean;
    enableLazyLoading: boolean;
    enableImageOptimization: boolean;
    imageQuality: number;
  };
  backup: {
    autoBackup: boolean;
    backupFrequency: 'daily' | 'weekly' | 'monthly';
    backupRetention: number;
    backupLocation: string;
    includeUploads: boolean;
    includeDatabase: boolean;
    lastBackup?: string;
  };
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // API Hooks
  const { data: settingsData, isLoading, refetch } = useSystemSettings();
  const updateSettingsMutation = useUpdateSystemSettings();

  const [settings, setSettings] = useState<SystemSettings>({
    general: {
      siteName: 'My Blog',
      siteDescription: 'A multi-user blogging platform',
      siteUrl: 'http://localhost:3001',
      contactEmail: 'admin@myblog.com',
      timeZone: 'Asia/Seoul',
      dateFormat: 'MMM dd, yyyy',
      maintenanceMode: false,
      maintenanceMessage: '',
    },
    content: {
      postsPerPage: 10,
      commentsPerPage: 20,
      maxUploadSize: 10,
      allowedFileTypes: ['jpg', 'jpeg', 'png', 'gif', 'pdf'],
      enableComments: true,
      requireCommentModeration: false,
      enableLikes: true,
      enableSharing: true,
    },
    security: {
      requireEmailVerification: true,
      passwordMinLength: 8,
      passwordRequireUppercase: true,
      passwordRequireNumbers: true,
      passwordRequireSpecialChars: false,
      maxLoginAttempts: 5,
      lockoutDuration: 30,
      enableTwoFactor: false,
      sessionTimeout: 1440,
    },
    email: {
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: '',
      smtpPassword: '',
      fromEmail: 'noreply@myblog.com',
      fromName: 'My Blog',
      emailTemplates: {
        welcome: true,
        passwordReset: true,
        emailVerification: true,
        newComment: true,
        newReport: true,
      },
    },
    notifications: {
      emailNotifications: true,
      pushNotifications: false,
      adminAlerts: {
        newUser: true,
        newReport: true,
        systemError: true,
        lowDiskSpace: true,
        highTraffic: false,
      },
      userNotifications: {
        newComment: true,
        newLike: true,
        newFollower: false,
        postPublished: true,
      },
    },
    appearance: {
      theme: 'light',
      primaryColor: '#6366f1',
      secondaryColor: '#8b5cf6',
      fontFamily: 'Inter',
      logoUrl: '',
      faviconUrl: '',
      customCss: '',
      enableDarkMode: true,
    },
    performance: {
      enableCache: true,
      cacheDuration: 3600,
      enableCdn: false,
      cdnUrl: '',
      enableCompression: true,
      enableLazyLoading: true,
      enableImageOptimization: true,
      imageQuality: 85,
    },
    backup: {
      autoBackup: false,
      backupFrequency: 'daily',
      backupRetention: 30,
      backupLocation: '/backups',
      includeUploads: true,
      includeDatabase: true,
      lastBackup: undefined,
    },
  });

  useEffect(() => {
    if (settingsData) {
      setSettings(settingsData);
    }
  }, [settingsData]);

  const handleSaveSettings = async () => {
    updateSettingsMutation.mutate(settings, {
      onSuccess: () => {
        setHasChanges(false);
        refetch();
      },
    });
  };

  const handleResetSettings = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/admin/settings/reset`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to reset settings');
      }

      toast.success('설정이 기본값으로 재설정되었습니다');
      refetch();
      setShowResetDialog(false);
    } catch (error) {
      console.error('Error resetting settings:', error);
      toast.error('설정 재설정에 실패했습니다');
    }
  };

  const handleBackup = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/admin/backup/create`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create backup');
      }

      const data = await response.json();
      toast.success(`백업 생성됨: ${data.filename}`);
      setShowBackupDialog(false);
      
      // Update last backup time
      setSettings(prev => ({
        ...prev,
        backup: {
          ...prev.backup,
          lastBackup: new Date().toISOString(),
        },
      }));
    } catch (error) {
      console.error('Error creating backup:', error);
      toast.error('백업 생성에 실패했습니다');
    }
  };

  const updateSetting = (category: keyof SystemSettings, field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value,
      },
    }));
    setHasChanges(true);
  };

  const updateNestedSetting = (category: keyof SystemSettings, parent: string, field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [parent]: {
          ...(prev[category] as any)[parent],
          [field]: value,
        },
      },
    }));
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.settings.title}</h1>
          <p className="text-gray-600 mt-1">{t.settings.subtitle}</p>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <Badge className="bg-yellow-100 text-yellow-800">
              저장되지 않은 변경사항
            </Badge>
          )}
          <Button
            variant="outline"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {t.actions.refresh}
          </Button>
          <Button
            onClick={handleSaveSettings}
            disabled={!hasChanges || updateSettingsMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {updateSettingsMutation.isPending ? '저장 중...' : t.settings.saveSettings}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-8 w-full">
          <TabsTrigger value="general">{t.settings.general}</TabsTrigger>
          <TabsTrigger value="content">콘텐츠</TabsTrigger>
          <TabsTrigger value="security">{t.settings.security}</TabsTrigger>
          <TabsTrigger value="email">{t.settings.email}</TabsTrigger>
          <TabsTrigger value="notifications">알림</TabsTrigger>
          <TabsTrigger value="appearance">{t.settings.appearance}</TabsTrigger>
          <TabsTrigger value="performance">성능</TabsTrigger>
          <TabsTrigger value="backup">백업</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>{t.settings.general}</CardTitle>
              <CardDescription>블로그 플랫폼의 기본 설정</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="siteName">{t.settings.siteName}</Label>
                  <Input
                    id="siteName"
                    value={settings.general.siteName}
                    onChange={(e) => updateSetting('general', 'siteName', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="siteUrl">{t.settings.siteUrl}</Label>
                  <Input
                    id="siteUrl"
                    value={settings.general.siteUrl}
                    onChange={(e) => updateSetting('general', 'siteUrl', e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="siteDescription">{t.settings.siteDescription}</Label>
                <Textarea
                  id="siteDescription"
                  value={settings.general.siteDescription}
                  onChange={(e) => updateSetting('general', 'siteDescription', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contactEmail">연락처 이메일</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={settings.general.contactEmail}
                    onChange={(e) => updateSetting('general', 'contactEmail', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="timeZone">{t.settings.timezone}</Label>
                  <Select
                    value={settings.general.timeZone}
                    onValueChange={(value) => updateSetting('general', 'timeZone', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Seoul">Asia/Seoul</SelectItem>
                      <SelectItem value="America/New_York">America/New York</SelectItem>
                      <SelectItem value="Europe/London">Europe/London</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>유지보수 모드</Label>
                    <p className="text-sm text-gray-500">
                      일시적으로 사이트 공개 접근을 비활성화
                    </p>
                  </div>
                  <Switch
                    checked={settings.general.maintenanceMode}
                    onCheckedChange={(checked) => updateSetting('general', 'maintenanceMode', checked)}
                  />
                </div>
                {settings.general.maintenanceMode && (
                  <div className="mt-4">
                    <Label htmlFor="maintenanceMessage">유지보수 메시지</Label>
                    <Textarea
                      id="maintenanceMessage"
                      value={settings.general.maintenanceMessage}
                      onChange={(e) => updateSetting('general', 'maintenanceMessage', e.target.value)}
                      placeholder="Site is under maintenance. We'll be back soon!"
                      rows={2}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Content Settings */}
        <TabsContent value="content">
          <Card>
            <CardHeader>
              <CardTitle>콘텐츠 설정</CardTitle>
              <CardDescription>콘텐츠 표시 및 상호작용 설정 관리</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="postsPerPage">Posts Per Page</Label>
                  <Input
                    id="postsPerPage"
                    type="number"
                    value={settings.content.postsPerPage}
                    onChange={(e) => updateSetting('content', 'postsPerPage', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="commentsPerPage">Comments Per Page</Label>
                  <Input
                    id="commentsPerPage"
                    type="number"
                    value={settings.content.commentsPerPage}
                    onChange={(e) => updateSetting('content', 'commentsPerPage', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="maxUploadSize">Max Upload Size (MB)</Label>
                <Input
                  id="maxUploadSize"
                  type="number"
                  value={settings.content.maxUploadSize}
                  onChange={(e) => updateSetting('content', 'maxUploadSize', parseInt(e.target.value))}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Comments</Label>
                    <p className="text-sm text-gray-500">Allow users to comment on posts</p>
                  </div>
                  <Switch
                    checked={settings.content.enableComments}
                    onCheckedChange={(checked) => updateSetting('content', 'enableComments', checked)}
                  />
                </div>

                {settings.content.enableComments && (
                  <div className="flex items-center justify-between pl-6">
                    <div className="space-y-0.5">
                      <Label>Require Comment Moderation</Label>
                      <p className="text-sm text-gray-500">Review comments before publishing</p>
                    </div>
                    <Switch
                      checked={settings.content.requireCommentModeration}
                      onCheckedChange={(checked) => updateSetting('content', 'requireCommentModeration', checked)}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Likes</Label>
                    <p className="text-sm text-gray-500">Allow users to like posts</p>
                  </div>
                  <Switch
                    checked={settings.content.enableLikes}
                    onCheckedChange={(checked) => updateSetting('content', 'enableLikes', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Sharing</Label>
                    <p className="text-sm text-gray-500">Show social media sharing buttons</p>
                  </div>
                  <Switch
                    checked={settings.content.enableSharing}
                    onCheckedChange={(checked) => updateSetting('content', 'enableSharing', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>{t.settings.security}</CardTitle>
              <CardDescription>보안 및 인증 설정 구성</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Require Email Verification</Label>
                    <p className="text-sm text-gray-500">Users must verify email before login</p>
                  </div>
                  <Switch
                    checked={settings.security.requireEmailVerification}
                    onCheckedChange={(checked) => updateSetting('security', 'requireEmailVerification', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Two-Factor Authentication</Label>
                    <p className="text-sm text-gray-500">Additional security for user accounts</p>
                  </div>
                  <Switch
                    checked={settings.security.enableTwoFactor}
                    onCheckedChange={(checked) => updateSetting('security', 'enableTwoFactor', checked)}
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">Password Requirements</h3>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="passwordMinLength">Minimum Length</Label>
                    <Input
                      id="passwordMinLength"
                      type="number"
                      value={settings.security.passwordMinLength}
                      onChange={(e) => updateSetting('security', 'passwordMinLength', parseInt(e.target.value))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={settings.security.passwordRequireUppercase}
                        onChange={(e) => updateSetting('security', 'passwordRequireUppercase', e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">Require uppercase letter</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={settings.security.passwordRequireNumbers}
                        onChange={(e) => updateSetting('security', 'passwordRequireNumbers', e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">Require number</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={settings.security.passwordRequireSpecialChars}
                        onChange={(e) => updateSetting('security', 'passwordRequireSpecialChars', e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">Require special character</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">Login Security</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="maxLoginAttempts">Max Login Attempts</Label>
                    <Input
                      id="maxLoginAttempts"
                      type="number"
                      value={settings.security.maxLoginAttempts}
                      onChange={(e) => updateSetting('security', 'maxLoginAttempts', parseInt(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="lockoutDuration">Lockout Duration (minutes)</Label>
                    <Input
                      id="lockoutDuration"
                      type="number"
                      value={settings.security.lockoutDuration}
                      onChange={(e) => updateSetting('security', 'lockoutDuration', parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Other tabs would follow similar pattern... */}
        
      </Tabs>

      {/* Action Buttons */}
      <div className="mt-8 flex justify-between">
        <Button
          variant="destructive"
          onClick={() => setShowResetDialog(true)}
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          {t.settings.resetDefaults}
        </Button>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowBackupDialog(true)}
          >
            <HardDrive className="h-4 w-4 mr-2" />
            백업 생성
          </Button>
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>정말로 재설정하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              모든 설정이 기본값으로 재설정됩니다. 이 작업은 실행 취소할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.actions.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetSettings}>
              설정 재설정
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Backup Confirmation Dialog */}
      <AlertDialog open={showBackupDialog} onOpenChange={setShowBackupDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>백업 생성</AlertDialogTitle>
            <AlertDialogDescription>
              데이터베이스와 설정의 백업을 생성합니다. 백업은 설정된 위치에 저장됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.actions.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleBackup}>
              백업 생성
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}