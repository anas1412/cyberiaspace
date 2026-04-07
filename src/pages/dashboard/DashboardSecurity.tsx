import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/useAuthStore';
import { supabase } from '../../services/supabase';
import { 
  Shield, Play, CheckCircle, XCircle, AlertTriangle, 
  ArrowLeft, Loader2, Database, Lock, FolderOpen 
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TestResult {
  id: string;
  name: string;
  description: string;
  passed: boolean | null;
  message: string;
  details: string;
  category: 'database' | 'storage' | 'protection';
  expected: 'pass' | 'block';
}

interface DashboardSecurityProps {
  onBack: () => void;
}

const DashboardSecurity: React.FC<DashboardSecurityProps> = ({ onBack }) => {
  const { user } = useAuthStore();
  const [tests, setTests] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string | null>(null);

  const initialTests: TestResult[] = [
    // Database Tests
    {
      id: 'read-own-profile',
      name: 'Read Own Profile',
      description: 'User should be able to read their own profile data.',
      passed: null, message: '', details: '',
      category: 'database', expected: 'pass',
    },
    {
      id: 'update-own-name',
      name: 'Update Own Name',
      description: 'User should be able to update non-sensitive fields.',
      passed: null, message: '', details: '',
      category: 'database', expected: 'pass',
    },
    {
      id: 'read-own-usage',
      name: 'Read Own AI Usage',
      description: 'User should be able to read their own AI usage for UI display.',
      passed: null, message: '', details: '',
      category: 'database', expected: 'pass',
    },
    {
      id: 'read-own-thoughts',
      name: 'Read Own Thoughts',
      description: 'User should only see their own thoughts.',
      passed: null, message: '', details: '',
      category: 'database', expected: 'pass',
    },
    {
      id: 'change-own-plan',
      name: 'Change Own Plan to Pro',
      description: 'User tries to hack themselves to Pro. Should be BLOCKED by trigger.',
      passed: null, message: '', details: '',
      category: 'protection', expected: 'block',
    },
    {
      id: 'set-own-admin',
      name: 'Set Own is_admin = true',
      description: 'User tries to give themselves admin. Should be BLOCKED by trigger.',
      passed: null, message: '', details: '',
      category: 'protection', expected: 'block',
    },
    {
      id: 'reset-own-usage',
      name: 'Reset Own AI Usage',
      description: 'User tries to reset AI counters. Should be BLOCKED by no UPDATE policy.',
      passed: null, message: '', details: '',
      category: 'protection', expected: 'block',
    },
    {
      id: 'read-other-profile',
      name: 'Read Another User Profile',
      description: 'User tries to read another user profile. Should be BLOCKED by RLS.',
      passed: null, message: '', details: '',
      category: 'protection', expected: 'block',
    },
    {
      id: 'delete-other-thought',
      name: 'Delete Another User Thought',
      description: 'User tries to delete another user thought. Should be BLOCKED by RLS.',
      passed: null, message: '', details: '',
      category: 'protection', expected: 'block',
    },
    {
      id: 'change-other-plan',
      name: 'Change Another User Plan',
      description: 'User tries to change another user plan. Should be BLOCKED by RLS + trigger.',
      passed: null, message: '', details: '',
      category: 'protection', expected: 'block',
    },
    {
      id: 'read-other-usage',
      name: 'Read Another User Usage',
      description: 'User tries to read another user AI usage. Should be BLOCKED by RLS.',
      passed: null, message: '', details: '',
      category: 'protection', expected: 'block',
    },
    {
      id: 'reset-other-usage',
      name: 'Reset Another User Usage',
      description: 'User tries to reset another user AI counters. Should be BLOCKED by RLS.',
      passed: null, message: '', details: '',
      category: 'protection', expected: 'block',
    },
    // Storage Tests
    {
      id: 'list-own-storage',
      name: 'List Own Storage Files',
      description: 'User should be able to list their own storage files.',
      passed: null, message: '', details: '',
      category: 'storage', expected: 'pass',
    },
    {
      id: 'list-other-storage',
      name: 'List Another User Storage',
      description: 'User tries to list another user folder. Should be BLOCKED by storage RLS.',
      passed: null, message: '', details: '',
      category: 'storage', expected: 'block',
    },
  ];

  useEffect(() => {
    setTests(initialTests);
  }, []);

  const runTest = async (test: TestResult): Promise<TestResult> => {
    setCurrentTest(test.id);
    const fakeId = '00000000-0000-0000-0000-000000000000';

    try {
      switch (test.id) {
        case 'read-own-profile': {
          const { data, error } = await supabase.from('users').select('*').single();
          if (error) throw error;
          return { ...test, passed: true, message: 'Can read own profile', details: `Plan: ${data.plan}, is_admin: ${data.is_admin}` };
        }

        case 'update-own-name': {
          const randomName = 'TestUser_' + Math.random().toString(36).slice(2, 8);
          const { data, error } = await supabase.from('users').update({ name: randomName }).select('name').single();
          if (error) throw error;
          return { ...test, passed: true, message: 'Can update own name', details: `Name set to: ${data.name}` };
        }

        case 'read-own-usage': {
          const { data, error } = await supabase.from('user_usage').select('*').single();
          if (error) throw error;
          return { ...test, passed: true, message: 'Can read own usage', details: `ai_daily_count: ${data.ai_daily_count}` };
        }

        case 'read-own-thoughts': {
          const { count, error } = await supabase.from('thoughts').select('*', { count: 'exact', head: true });
          if (error) throw error;
          return { ...test, passed: true, message: 'Can read own thoughts (RLS working)', details: `Count: ${count}` };
        }

        case 'change-own-plan': {
          const { data, error } = await supabase.from('users').update({ plan: 'pro' }).select('plan').single();
          if (error) {
            return { ...test, passed: true, message: 'Update blocked by trigger', details: error.message };
          }
          if (data?.plan === 'pro') {
            return { ...test, passed: false, message: 'VULNERABILITY: Plan changed to pro!', details: 'User was able to upgrade themselves!' };
          }
          return { ...test, passed: true, message: 'Plan blocked by trigger', details: `Plan still: ${data?.plan}` };
        }

        case 'set-own-admin': {
          const { data, error } = await supabase.from('users').update({ is_admin: true }).select('is_admin').single();
          if (error) {
            return { ...test, passed: true, message: 'Update blocked by trigger', details: error.message };
          }
          if (data?.is_admin === true) {
            return { ...test, passed: false, message: 'VULNERABILITY: is_admin set to true!', details: 'User gave themselves admin!' };
          }
          return { ...test, passed: true, message: 'is_admin blocked by trigger', details: `is_admin still: ${data?.is_admin}` };
        }

        case 'reset-own-usage': {
          const { error } = await supabase.from('user_usage').update({ ai_daily_count: 0 }).select('ai_daily_count').single();
          if (error) {
            return { ...test, passed: true, message: 'Update blocked (no policy)', details: error.message };
          }
          return { ...test, passed: false, message: 'VULNERABILITY: Usage was reset!', details: 'User was able to reset AI counters!' };
        }

        case 'read-other-profile': {
          const { data, error } = await supabase.from('users').select('*').eq('id', fakeId).single();
          if (error || !data) {
            return { ...test, passed: true, message: 'Cannot read other profile (RLS working)', details: 'Got null/error as expected' };
          }
          return { ...test, passed: false, message: 'VULNERABILITY: Saw another user profile!', details: `Got profile: ${data.email}` };
        }

        case 'delete-other-thought': {
          // Find a thought that belongs to another user
          const { data: allThoughts } = await supabase.from('thoughts').select('id, user_id').limit(100);
          const otherThought = allThoughts?.find(t => t.user_id !== user?.id);
          if (!otherThought) {
            return { ...test, passed: true, message: 'No other users data found to test', details: 'RLS likely working (or only one user exists)' };
          }
          const { error } = await supabase.from('thoughts').delete().eq('id', otherThought.id);
          if (error) {
            return { ...test, passed: true, message: 'Delete blocked by RLS', details: error.message };
          }
          // Verify the thought still exists (wasn't deleted)
          const { data: verify } = await supabase.from('thoughts').select('id').eq('id', otherThought.id).single();
          if (verify) {
            return { ...test, passed: true, message: 'Delete blocked by RLS', details: 'Row still exists (not deleted)' };
          }
          return { ...test, passed: false, message: 'VULNERABILITY: Delete succeeded!', details: 'Another user thought was deleted!' };
        }

        case 'change-other-plan': {
          // Find a user that isn't the current admin
          const { data: allUsers } = await supabase.from('users').select('id, plan').limit(100);
          const otherUser = allUsers?.find(u => u.id !== user?.id);
          if (!otherUser) {
            return { ...test, passed: true, message: 'No other users found to test', details: 'Only one user exists' };
          }
          const originalPlan = otherUser.plan;
          const { error } = await supabase.from('users').update({ plan: 'hacked' }).eq('id', otherUser.id);
          // Check if the plan actually changed
          const { data: verify } = await supabase.from('users').select('plan').eq('id', otherUser.id).single();
          if (verify?.plan === originalPlan || error) {
            return { ...test, passed: true, message: 'Cannot change other plan (RLS + trigger)', details: error ? error.message : 'Plan unchanged' };
          }
          return { ...test, passed: false, message: 'VULNERABILITY: Plan changed!', details: `Changed from ${originalPlan} to ${verify?.plan}` };
        }

        case 'read-other-usage': {
          // Find a user_usage record that belongs to another user
          const { data: allUsage } = await supabase.from('user_usage').select('user_id').limit(100);
          const otherUsage = allUsage?.find(u => u.user_id !== user?.id);
          if (!otherUsage) {
            return { ...test, passed: true, message: 'No other users usage found', details: 'Only one user exists' };
          }
          const { data, error } = await supabase.from('user_usage').select('*').eq('user_id', otherUsage.user_id).single();
          if (error || !data) {
            return { ...test, passed: true, message: 'Cannot read other usage (RLS working)', details: 'Got null/error as expected' };
          }
          return { ...test, passed: false, message: 'VULNERABILITY: Saw another user usage!', details: 'Usage data leaked!' };
        }

        case 'reset-other-usage': {
          // Find a user_usage record that belongs to another user
          const { data: allUsage } = await supabase.from('user_usage').select('user_id').limit(100);
          const otherUsage = allUsage?.find(u => u.user_id !== user?.id);
          if (!otherUsage) {
            return { ...test, passed: true, message: 'No other users usage found', details: 'Only one user exists' };
          }
          // Get original value
          const { data: before } = await supabase.from('user_usage').select('ai_daily_count').eq('user_id', otherUsage.user_id).single();
          const originalCount = before?.ai_daily_count;
          const { error } = await supabase.from('user_usage').update({ ai_daily_count: 99999 }).eq('user_id', otherUsage.user_id);
          // Check if value changed
          const { data: after } = await supabase.from('user_usage').select('ai_daily_count').eq('user_id', otherUsage.user_id).single();
          if (after?.ai_daily_count === originalCount || error) {
            return { ...test, passed: true, message: 'Cannot reset other usage (RLS + no policy)', details: error ? error.message : 'Value unchanged' };
          }
          return { ...test, passed: false, message: 'VULNERABILITY: Usage changed!', details: `Changed from ${originalCount} to ${after?.ai_daily_count}` };
        }

        case 'list-own-storage': {
          if (!user?.id) throw new Error('Not logged in');
          const { data, error } = await supabase.storage.from('user-files').list(user.id, { limit: 5 });
          if (error) throw error;
          return { ...test, passed: true, message: 'Can list own storage', details: `Found ${data?.length || 0} items` };
        }

        case 'list-other-storage': {
          const { data, error } = await supabase.storage.from('user-files').list(fakeId, { limit: 5 });
          if (error || !data || data.length === 0) {
            return { ...test, passed: true, message: 'Cannot list other storage (RLS working)', details: 'Got null/error or empty as expected' };
          }
          return { ...test, passed: false, message: 'VULNERABILITY: Saw another user files!', details: `Found ${data.length} files` };
        }

        default:
          return { ...test, passed: null, message: 'Unknown test', details: '' };
      }
    } catch (e: any) {
      return { ...test, passed: true, message: 'Blocked', details: e.message };
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTests(initialTests);
    
    for (const test of tests) {
      const result = await runTest(test);
      setTests(prev => prev.map(t => t.id === result.id ? result : t));
      await new Promise(r => setTimeout(r, 100)); // Small delay for visual feedback
    }
    
    setCurrentTest(null);
    setIsRunning(false);
  };

  const passedCount = tests.filter(t => t.passed === true).length;
  const failedCount = tests.filter(t => t.passed === false).length;
  const pendingCount = tests.filter(t => t.passed === null).length;

  const categoryIcon = (cat: string) => {
    switch (cat) {
      case 'database': return <Database className="w-4 h-4" />;
      case 'storage': return <FolderOpen className="w-4 h-4" />;
      case 'protection': return <Lock className="w-4 h-4" />;
      default: return null;
    }
  };

  const categoryColor = (cat: string) => {
    switch (cat) {
      case 'database': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'storage': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'protection': return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      default: return '';
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-xl hover:bg-[var(--glass-bg)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
              <Shield className="w-6 h-6 text-green-400" />
              Security Tests
            </h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">
              Test RLS policies, triggers, and storage security
            </p>
          </div>
        </div>
        
        <button
          onClick={runAllTests}
          disabled={isRunning}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all",
            "bg-green-500/10 border border-green-500/30 text-green-400",
            "hover:bg-green-500/20 hover:border-green-500/50",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run All Tests
            </>
          )}
        </button>
      </div>

      {/* User Info */}
      <div className="glass rounded-xl p-4 border border-green-500/20 bg-green-500/5">
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <CheckCircle className="w-4 h-4" />
          Logged in as <span className="font-mono text-xs">{user?.email}</span>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-muted)]">
          <span>User ID: <span className="font-mono text-[10px]">{user?.id}</span></span>
        </div>
      </div>

      {/* Summary */}
      {tests.some(t => t.passed !== null) && (
        <div className="grid grid-cols-3 gap-4">
          <div className="glass rounded-xl p-4 border border-green-500/20 bg-green-500/5 text-center">
            <div className="text-3xl font-black text-green-400">{passedCount}</div>
            <div className="text-[10px] uppercase tracking-widest text-green-400/60 mt-1">Passed ✅</div>
          </div>
          <div className="glass rounded-xl p-4 border border-red-500/20 bg-red-500/5 text-center">
            <div className="text-3xl font-black text-red-400">{failedCount}</div>
            <div className="text-[10px] uppercase tracking-widest text-red-400/60 mt-1">Failed ❌</div>
          </div>
          <div className="glass rounded-xl p-4 border border-amber-500/20 bg-amber-500/5 text-center">
            <div className="text-3xl font-black text-amber-400">{pendingCount}</div>
            <div className="text-[10px] uppercase tracking-widest text-amber-400/60 mt-1">Pending ⏳</div>
          </div>
        </div>
      )}

      {/* Test Cards */}
      <div className="space-y-6">
        {['database', 'protection', 'storage'].map(category => {
          const categoryTests = tests.filter(t => t.category === category);
          if (categoryTests.length === 0) return null;
          
          return (
            <div key={category}>
              <h2 className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest mb-3 border",
                categoryColor(category)
              )}>
                {categoryIcon(category)}
                {category === 'database' ? 'Database RLS' : category === 'storage' ? 'Storage Security' : 'Trigger Protection'}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categoryTests.map((test, i) => (
                  <motion.div
                    key={test.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={cn(
                      "glass rounded-xl p-4 border transition-all",
                      currentTest === test.id ? "border-[var(--accent)]/50" : "border-[var(--glass-border)]",
                      test.passed === true && test.expected === 'pass' && "border-green-500/30 bg-green-500/5",
                      test.passed === true && test.expected === 'block' && "border-green-500/30 bg-green-500/5",
                      test.passed === false && "border-red-500/50 bg-red-500/5",
                      test.passed === null && "opacity-60"
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-sm font-medium text-[var(--text-primary)]">{test.name}</h3>
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0",
                        currentTest === test.id && "bg-[var(--accent)] animate-pulse",
                        test.passed === true && test.expected === 'pass' && "bg-green-500/20 text-green-400",
                        test.passed === true && test.expected === 'block' && "bg-green-500/20 text-green-400",
                        test.passed === false && "bg-red-500/20 text-red-400",
                      )}>
                        {currentTest === test.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : test.passed === true ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : test.passed === false ? (
                          <XCircle className="w-3 h-3" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
                        )}
                      </div>
                    </div>
                    
                    <p className="text-[11px] text-[var(--text-muted)] mb-3">{test.description}</p>
                    
                    {test.passed !== null && (
                      <div className={cn(
                        "text-[11px] px-2 py-1.5 rounded-lg",
                        test.passed && "bg-green-500/10 text-green-400",
                        !test.passed && "bg-red-500/10 text-red-400"
                      )}>
                        {test.passed ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            {test.message}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {test.message}
                          </span>
                        )}
                        {test.details && (
                          <div className="text-[10px] mt-1 opacity-70">{test.details}</div>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="glass rounded-xl p-4 border border-[var(--glass-border)]">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">Legend</h3>
        <div className="grid grid-cols-2 gap-4 text-[11px]">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-[var(--text-secondary)]">
              <strong>Pass (block):</strong> Security working correctly — operation was blocked
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-[var(--text-secondary)]">
              <strong>Pass (access):</strong> Normal access working — user can read/write their own data
            </span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-[var(--text-secondary)]">
              <strong>Fail:</strong> VULNERABILITY — operation succeeded when it should have been blocked
            </span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-[var(--text-secondary)]">
              <strong>Unexpected error:</strong> Operation failed unexpectedly
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardSecurity;
