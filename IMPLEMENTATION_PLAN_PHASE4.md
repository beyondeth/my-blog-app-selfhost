# 📝 멀티테넌트 SaaS 플랫폼 - Phase 4 구현 계획

## 🎯 Phase 4: 프론트엔드 통합 및 UI/UX (Day 7-8)

### 1️⃣ Organization Context Management

#### A. Organization Store (Zustand)
**파일**: `frontend/src/stores/organization.store.ts`
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Organization {
  id: string;
  name: string;
  slug: string;
  type: 'personal' | 'team' | 'enterprise';
  role: string;
  permissions: string[];
}

interface OrganizationStore {
  // State
  currentOrganization: Organization | null;
  organizations: Organization[];
  isLoading: boolean;

  // Actions
  setCurrentOrganization: (org: Organization) => void;
  switchOrganization: (orgId: string) => Promise<void>;
  loadOrganizations: () => Promise<void>;
  createOrganization: (data: CreateOrgDto) => Promise<void>;
  inviteMember: (email: string, role: string) => Promise<void>;

  // Permissions
  hasPermission: (permission: string) => boolean;
  canCreateBlog: () => boolean;
  canInviteMembers: () => boolean;
  canManageBilling: () => boolean;
}

export const useOrganizationStore = create<OrganizationStore>()(
  persist(
    (set, get) => ({
      currentOrganization: null,
      organizations: [],
      isLoading: false,

      setCurrentOrganization: (org) => {
        set({ currentOrganization: org });
        // API 헤더에 조직 ID 설정
        apiClient.defaults.headers['X-Organization-Id'] = org.id;
      },

      switchOrganization: async (orgId) => {
        set({ isLoading: true });
        try {
          const { data } = await apiClient.post('/organizations/switch', { orgId });
          set({
            currentOrganization: data.organization,
            isLoading: false
          });

          // 페이지 새로고침 또는 라우팅
          window.location.href = '/dashboard';
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      loadOrganizations: async () => {
        set({ isLoading: true });
        try {
          const { data } = await apiClient.get('/organizations/my-organizations');
          set({
            organizations: data.organizations,
            currentOrganization: data.active,
            isLoading: false
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      createOrganization: async (createData) => {
        const { data } = await apiClient.post('/organizations', createData);
        set((state) => ({
          organizations: [...state.organizations, data]
        }));
        return data;
      },

      inviteMember: async (email, role) => {
        const org = get().currentOrganization;
        if (!org) throw new Error('No organization selected');

        await apiClient.post(`/organizations/${org.id}/invite`, { email, role });
      },

      // Permission helpers
      hasPermission: (permission) => {
        const org = get().currentOrganization;
        return org?.permissions?.includes(permission) || false;
      },

      canCreateBlog: () => {
        const org = get().currentOrganization;
        return ['owner', 'admin', 'editor'].includes(org?.role || '');
      },

      canInviteMembers: () => {
        const org = get().currentOrganization;
        return ['owner', 'admin'].includes(org?.role || '');
      },

      canManageBilling: () => {
        const org = get().currentOrganization;
        return org?.role === 'owner';
      }
    }),
    {
      name: 'organization-storage',
      partialize: (state) => ({
        currentOrganization: state.currentOrganization
      })
    }
  )
);
```

#### B. Organization Context Provider
**파일**: `frontend/src/contexts/OrganizationContext.tsx`
```typescript
'use client';

import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useOrganizationStore } from '@/stores/organization.store';
import { useAuthStore } from '@/stores/auth.store';
import { Loader2 } from 'lucide-react';

interface OrganizationContextValue {
  currentOrganization: Organization | null;
  organizations: Organization[];
  switchOrganization: (orgId: string) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  isLoading: boolean;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

export const OrganizationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuthStore();
  const {
    currentOrganization,
    organizations,
    switchOrganization,
    hasPermission,
    isLoading,
    loadOrganizations
  } = useOrganizationStore();

  useEffect(() => {
    if (user) {
      loadOrganizations();
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  return (
    <OrganizationContext.Provider
      value={{
        currentOrganization,
        organizations,
        switchOrganization,
        hasPermission,
        isLoading
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return context;
};
```

### 2️⃣ Organization Switcher UI

#### A. Organization Switcher Component
**파일**: `frontend/src/components/organization/OrganizationSwitcher.tsx`
```typescript
'use client';

import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Building2,
  ChevronDown,
  Plus,
  Settings,
  Users,
  CreditCard,
  LogOut
} from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useRouter } from 'next/navigation';

export const OrganizationSwitcher: React.FC = () => {
  const router = useRouter();
  const { currentOrganization, organizations, switchOrganization } = useOrganization();
  const [isLoading, setIsLoading] = useState(false);

  const handleSwitch = async (orgId: string) => {
    if (orgId === currentOrganization?.id) return;

    setIsLoading(true);
    try {
      await switchOrganization(orgId);
    } finally {
      setIsLoading(false);
    }
  };

  const getOrgTypeIcon = (type: string) => {
    switch (type) {
      case 'personal':
        return '👤';
      case 'team':
        return '👥';
      case 'enterprise':
        return '🏢';
      default:
        return '📁';
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between"
          disabled={isLoading}
        >
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback>
                {getOrgTypeIcon(currentOrganization?.type || 'personal')}
              </AvatarFallback>
            </Avatar>
            <span className="truncate max-w-[150px]">
              {currentOrganization?.name || 'Select Organization'}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-64">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Personal Organization */}
        <div className="px-2 py-1 text-xs text-muted-foreground">Personal</div>
        {organizations
          .filter(org => org.type === 'personal')
          .map(org => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => handleSwitch(org.id)}
              className={org.id === currentOrganization?.id ? 'bg-accent' : ''}
            >
              <Avatar className="h-5 w-5 mr-2">
                <AvatarFallback>👤</AvatarFallback>
              </Avatar>
              <span className="flex-1">{org.name}</span>
              {org.id === currentOrganization?.id && (
                <span className="text-xs text-muted-foreground">Current</span>
              )}
            </DropdownMenuItem>
          ))}

        {/* Team Organizations */}
        {organizations.filter(org => org.type !== 'personal').length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1 text-xs text-muted-foreground">Teams</div>
            {organizations
              .filter(org => org.type !== 'personal')
              .map(org => (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => handleSwitch(org.id)}
                  className={org.id === currentOrganization?.id ? 'bg-accent' : ''}
                >
                  <Avatar className="h-5 w-5 mr-2">
                    <AvatarFallback>
                      {getOrgTypeIcon(org.type)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div>{org.name}</div>
                    <div className="text-xs text-muted-foreground">{org.role}</div>
                  </div>
                  {org.id === currentOrganization?.id && (
                    <span className="text-xs text-muted-foreground">Current</span>
                  )}
                </DropdownMenuItem>
              ))}
          </>
        )}

        <DropdownMenuSeparator />

        {/* Actions */}
        <DropdownMenuItem onClick={() => router.push('/organizations/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Create Organization
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => router.push('/organizations/settings')}>
          <Settings className="h-4 w-4 mr-2" />
          Organization Settings
        </DropdownMenuItem>

        {currentOrganization?.role === 'owner' && (
          <DropdownMenuItem onClick={() => router.push('/organizations/billing')}>
            <CreditCard className="h-4 w-4 mr-2" />
            Billing & Subscription
          </DropdownMenuItem>
        )}

        {currentOrganization?.type !== 'personal' && (
          <DropdownMenuItem onClick={() => router.push('/organizations/members')}>
            <Users className="h-4 w-4 mr-2" />
            Manage Members
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
```

### 3️⃣ Subscription Management UI

#### A. Subscription Dashboard
**파일**: `frontend/src/app/subscription/page.tsx`
```typescript
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard,
  Package,
  TrendingUp,
  Users,
  HardDrive,
  FileText,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { subscriptionService } from '@/services/subscription.service';
import { PricingPlans } from '@/components/subscription/PricingPlans';
import { UsageChart } from '@/components/subscription/UsageChart';

export default function SubscriptionDashboard() {
  const { data: subscription, isLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: subscriptionService.getCurrentSubscription
  });

  const { data: usage } = useQuery({
    queryKey: ['usage'],
    queryFn: subscriptionService.getCurrentUsage
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      active: { variant: 'default', label: 'Active' },
      trialing: { variant: 'secondary', label: 'Trial' },
      past_due: { variant: 'destructive', label: 'Past Due' },
      canceled: { variant: 'outline', label: 'Canceled' }
    };

    const config = variants[status] || variants.active;
    return <Badge variant={config.variant as any}>{config.label}</Badge>;
  };

  const calculateUsagePercentage = (used: number, limit: number) => {
    if (limit === -1) return 0; // Unlimited
    return Math.min((used / limit) * 100, 100);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Subscription & Billing</h1>
          <p className="text-muted-foreground">
            Manage your subscription and monitor usage
          </p>
        </div>
        <Button onClick={() => window.location.href = '/subscription/upgrade'}>
          <TrendingUp className="h-4 w-4 mr-2" />
          Upgrade Plan
        </Button>
      </div>

      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {subscription?.plan?.displayName || 'Free Plan'}
              </CardTitle>
              <CardDescription>
                Your current subscription plan
              </CardDescription>
            </div>
            {getStatusBadge(subscription?.status || 'active')}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Price</p>
              <p className="text-2xl font-bold">
                ${subscription?.currentPrice || 0}/
                <span className="text-sm">{subscription?.billingCycle || 'month'}</span>
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Next Billing</p>
              <p className="font-medium">
                {subscription?.currentPeriodEnd
                  ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Member Since</p>
              <p className="font-medium">
                {subscription?.createdAt
                  ? new Date(subscription.createdAt).toLocaleDateString()
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Payment Method</p>
              <div className="flex items-center gap-1">
                <CreditCard className="h-4 w-4" />
                <p className="font-medium">•••• 4242</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-6">
            <Button variant="outline" size="sm">
              Update Payment Method
            </Button>
            <Button variant="outline" size="sm">
              Download Invoices
            </Button>
            {subscription?.status === 'active' && (
              <Button variant="outline" size="sm" className="text-destructive">
                Cancel Subscription
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Blogs Usage */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {usage?.blogs?.used || 0} / {usage?.blogs?.limit || 1}
              </span>
            </div>
            <h3 className="font-semibold mb-2">Blogs</h3>
            <Progress
              value={calculateUsagePercentage(
                usage?.blogs?.used || 0,
                usage?.blogs?.limit || 1
              )}
              className="h-2"
            />
          </CardContent>
        </Card>

        {/* Posts Usage */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {usage?.posts?.used || 0} / {usage?.posts?.limit || 10}
              </span>
            </div>
            <h3 className="font-semibold mb-2">Posts/Month</h3>
            <Progress
              value={calculateUsagePercentage(
                usage?.posts?.used || 0,
                usage?.posts?.limit || 10
              )}
              className="h-2"
            />
          </CardContent>
        </Card>

        {/* Storage Usage */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <HardDrive className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {usage?.storage?.used || 0}MB / {usage?.storage?.limit || 100}MB
              </span>
            </div>
            <h3 className="font-semibold mb-2">Storage</h3>
            <Progress
              value={calculateUsagePercentage(
                usage?.storage?.used || 0,
                usage?.storage?.limit || 100
              )}
              className="h-2"
            />
          </CardContent>
        </Card>

        {/* Team Members */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Users className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {usage?.members?.used || 1} / {usage?.members?.limit || 1}
              </span>
            </div>
            <h3 className="font-semibold mb-2">Team Members</h3>
            <Progress
              value={calculateUsagePercentage(
                usage?.members?.used || 1,
                usage?.members?.limit || 1
              )}
              className="h-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Usage Alerts */}
      {usage?.alerts && usage.alerts.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="h-5 w-5" />
              Usage Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {usage.alerts.map((alert: any, index: number) => (
                <li key={index} className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <span className="text-sm text-yellow-800">{alert.message}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Usage Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Trends</CardTitle>
          <CardDescription>
            Your usage patterns over the last 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsageChart data={usage?.history || []} />
        </CardContent>
      </Card>

      {/* Available Plans */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Available Plans</h2>
        <PricingPlans currentPlan={subscription?.plan?.code} />
      </div>
    </div>
  );
}
```

### 4️⃣ Team Management UI

#### A. Team Members Page
**파일**: `frontend/src/app/organizations/members/page.tsx`
```typescript
'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  UserPlus,
  MoreHorizontal,
  Mail,
  Shield,
  Trash2,
  Edit
} from 'lucide-react';
import { organizationService } from '@/services/organization.service';
import { toast } from '@/hooks/use-toast';

export default function TeamMembersPage() {
  const queryClient = useQueryClient();
  const [inviteDialog, setInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');

  const { data: members, isLoading } = useQuery({
    queryKey: ['organization-members'],
    queryFn: organizationService.getMembers
  });

  const inviteMutation = useMutation({
    mutationFn: ({ email, role }: { email: string; role: string }) =>
      organizationService.inviteMember(email, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members'] });
      toast({
        title: 'Invitation sent',
        description: 'The invitation has been sent successfully.',
      });
      setInviteDialog(false);
      setInviteEmail('');
      setInviteRole('viewer');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to send invitation.',
        variant: 'destructive',
      });
    }
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => organizationService.removeMember(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members'] });
      toast({
        title: 'Member removed',
        description: 'The member has been removed from the organization.',
      });
    }
  });

  const handleInvite = () => {
    if (inviteEmail && inviteRole) {
      inviteMutation.mutate({ email: inviteEmail, role: inviteRole });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    const variants = {
      owner: 'default',
      admin: 'secondary',
      editor: 'outline',
      writer: 'outline',
      viewer: 'outline'
    };
    return variants[role] || 'outline';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Team Members</h1>
          <p className="text-muted-foreground">
            Manage your organization's team members and permissions
          </p>
        </div>
        <Button onClick={() => setInviteDialog(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Member
        </Button>
      </div>

      {/* Members Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members?.map((member: any) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      {member.user?.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="font-medium">{member.user?.username}</p>
                      <p className="text-sm text-muted-foreground">
                        {member.user?.email}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <Badge variant={getRoleBadgeVariant(member.role) as any}>
                      {member.role}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  {member.acceptedAt ? (
                    <Badge variant="outline" className="text-green-600">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-yellow-600">
                      Pending
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {member.acceptedAt
                    ? new Date(member.acceptedAt).toLocaleDateString()
                    : 'Not joined yet'}
                </TableCell>
                <TableCell>
                  {member.role !== 'owner' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMutation.mutate(member.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Invite Dialog */}
      <Dialog open={inviteDialog} onOpenChange={setInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your organization
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Email Address</label>
              <Input
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Role</label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="writer">Writer</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={inviteMutation.isPending}>
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

### 5️⃣ Permission-based UI Components

#### A. PermissionGate Component
**파일**: `frontend/src/components/auth/PermissionGate.tsx`
```typescript
'use client';

import React from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';

interface PermissionGateProps {
  permission?: string;
  role?: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  permission,
  role,
  fallback = null,
  children
}) => {
  const { currentOrganization, hasPermission } = useOrganization();

  // Check permission
  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  // Check role
  if (role && currentOrganization) {
    if (!role.includes(currentOrganization.role)) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
};
```

#### B. Plan Limit Component
**파일**: `frontend/src/components/subscription/PlanLimitBanner.tsx`
```typescript
'use client';

import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface PlanLimitBannerProps {
  resource: string;
  used: number;
  limit: number;
  upgradeUrl?: string;
}

export const PlanLimitBanner: React.FC<PlanLimitBannerProps> = ({
  resource,
  used,
  limit,
  upgradeUrl = '/subscription/upgrade'
}) => {
  const router = useRouter();
  const percentage = (used / limit) * 100;

  if (percentage < 80) return null;

  const isExceeded = percentage >= 100;
  const variant = isExceeded ? 'destructive' : 'warning';

  return (
    <Alert variant={variant as any}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>
        {isExceeded ? `${resource} limit exceeded` : `Approaching ${resource} limit`}
      </AlertTitle>
      <AlertDescription className="mt-2">
        <div className="space-y-2">
          <p>
            You're using {used} out of {limit} {resource.toLowerCase()}.
            {isExceeded
              ? ' Please upgrade your plan to continue.'
              : ' Consider upgrading your plan for more resources.'}
          </p>
          <Progress value={Math.min(percentage, 100)} className="h-2" />
          <Button
            size="sm"
            variant={isExceeded ? 'default' : 'outline'}
            onClick={() => router.push(upgradeUrl)}
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Upgrade Plan
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};
```

### 6️⃣ API Service Layer

#### A. Organization Service
**파일**: `frontend/src/services/organization.service.ts`
```typescript
import { apiClient } from '@/lib/api-client';

export interface CreateOrganizationDto {
  name: string;
  slug: string;
  type: 'team' | 'enterprise';
}

export interface InviteMemberDto {
  email: string;
  roleId: number;
}

class OrganizationService {
  async getMyOrganizations() {
    const { data } = await apiClient.get('/organizations/my-organizations');
    return data;
  }

  async createOrganization(dto: CreateOrganizationDto) {
    const { data } = await apiClient.post('/organizations', dto);
    return data;
  }

  async switchOrganization(organizationId: string) {
    const { data } = await apiClient.post('/organizations/switch', {
      organizationId
    });
    return data;
  }

  async getMembers(organizationId?: string) {
    const orgId = organizationId || apiClient.defaults.headers['X-Organization-Id'];
    const { data } = await apiClient.get(`/organizations/${orgId}/members`);
    return data;
  }

  async inviteMember(email: string, role: string) {
    const orgId = apiClient.defaults.headers['X-Organization-Id'];
    const { data } = await apiClient.post(`/organizations/${orgId}/invite`, {
      email,
      role
    });
    return data;
  }

  async removeMember(memberId: string) {
    const orgId = apiClient.defaults.headers['X-Organization-Id'];
    const { data } = await apiClient.delete(
      `/organizations/${orgId}/members/${memberId}`
    );
    return data;
  }

  async updateMemberRole(memberId: string, roleId: number) {
    const orgId = apiClient.defaults.headers['X-Organization-Id'];
    const { data } = await apiClient.patch(
      `/organizations/${orgId}/members/${memberId}`,
      { roleId }
    );
    return data;
  }
}

export const organizationService = new OrganizationService();
```

#### B. Subscription Service
**파일**: `frontend/src/services/subscription.service.ts`
```typescript
import { apiClient } from '@/lib/api-client';

export interface UpgradePlanDto {
  planCode: string;
  billingCycle: 'monthly' | 'yearly';
  paymentMethodId?: string;
}

class SubscriptionService {
  async getCurrentSubscription() {
    const { data } = await apiClient.get('/subscriptions/current');
    return data;
  }

  async getCurrentUsage() {
    const { data } = await apiClient.get('/subscriptions/usage');
    return data;
  }

  async getAvailablePlans() {
    const { data } = await apiClient.get('/subscriptions/plans');
    return data;
  }

  async upgradePlan(dto: UpgradePlanDto) {
    const { data } = await apiClient.post('/subscriptions/upgrade', dto);
    return data;
  }

  async downgradePlan(planCode: string) {
    const { data } = await apiClient.post('/subscriptions/downgrade', {
      planCode
    });
    return data;
  }

  async cancelSubscription(reason: string) {
    const { data } = await apiClient.post('/subscriptions/cancel', {
      reason
    });
    return data;
  }

  async resumeSubscription() {
    const { data } = await apiClient.post('/subscriptions/resume');
    return data;
  }

  async getInvoices() {
    const { data } = await apiClient.get('/subscriptions/invoices');
    return data;
  }

  async updatePaymentMethod(paymentMethodId: string) {
    const { data } = await apiClient.post('/subscriptions/payment-method', {
      paymentMethodId
    });
    return data;
  }
}

export const subscriptionService = new SubscriptionService();
```

### 7️⃣ 라우트 보호

#### A. Organization Route Guard
**파일**: `frontend/src/components/guards/OrganizationGuard.tsx`
```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Loader2 } from 'lucide-react';

interface OrganizationGuardProps {
  requiredRole?: string[];
  requiredPermission?: string;
  children: React.ReactNode;
}

export const OrganizationGuard: React.FC<OrganizationGuardProps> = ({
  requiredRole,
  requiredPermission,
  children
}) => {
  const router = useRouter();
  const { currentOrganization, hasPermission, isLoading } = useOrganization();

  useEffect(() => {
    if (!isLoading && !currentOrganization) {
      router.push('/organizations/select');
      return;
    }

    if (requiredRole && currentOrganization) {
      if (!requiredRole.includes(currentOrganization.role)) {
        router.push('/unauthorized');
        return;
      }
    }

    if (requiredPermission && !hasPermission(requiredPermission)) {
      router.push('/unauthorized');
      return;
    }
  }, [currentOrganization, isLoading, requiredRole, requiredPermission]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  if (!currentOrganization) {
    return null;
  }

  return <>{children}</>;
};
```

## 📊 예상 결과

### 구현 후 기능:
1. ✅ Organization 컨텍스트 전환
2. ✅ 구독 플랜 관리 UI
3. ✅ 팀 멤버 초대 및 관리
4. ✅ 사용량 모니터링 대시보드
5. ✅ 권한 기반 UI 렌더링
6. ✅ 결제 방법 관리

### UI/UX 개선:
- 직관적인 조직 전환
- 실시간 사용량 표시
- 명확한 권한 피드백
- 반응형 디자인

## ⚠️ 주의사항

1. **State Management**: Zustand store와 React Query 캐시 동기화
2. **Permission Check**: 클라이언트 권한 체크는 UI용, 실제 보안은 서버에서
3. **Error Handling**: API 에러 시 사용자 친화적 메시지
4. **Loading States**: 모든 비동기 작업에 로딩 상태 표시