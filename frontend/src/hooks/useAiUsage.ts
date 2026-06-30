'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  appendAiUsageSnapshot,
  fetchAiUsageState,
  saveAiUsageAccount,
  syncAiUsageAccount,
  testAiUsageConnection
} from '@/lib/api';
import type { AiUsageState } from '@/lib/types';

const EMPTY_STATE: AiUsageState = {
  summary: {
    totalAccounts: 0,
    warningAccounts: 0,
    staleAccounts: 0,
    snapshotCount: 0,
    lastCollectedAt: null
  },
  accounts: [],
  recentSnapshots: []
};

export interface UseAiUsageResult {
  data: AiUsageState;
  loading: boolean;
  saving: boolean;
  testing: boolean;
  syncingAccountId: string | null;
  error: string | null;
  refresh: () => Promise<void>;
  saveAccount: (account: Record<string, unknown>) => Promise<unknown>;
  saveSnapshot: (snapshot: Record<string, unknown>) => Promise<unknown>;
  testConnection: (config: Record<string, unknown>) => Promise<unknown>;
  syncAccount: (accountId: string) => Promise<unknown>;
  syncAllAccounts: (accountIds: string[]) => Promise<{ accountId: string; ok: boolean; error?: string }[]>;
}

export function useAiUsage(): UseAiUsageResult {
  const [data, setData] = useState<AiUsageState>(EMPTY_STATE);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const state = await fetchAiUsageState();
      setData(state || EMPTY_STATE);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const saveAccount = useCallback(async (account: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      const res = await saveAiUsageAccount(account);
      setData(res.state || EMPTY_STATE);
      return res.account;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setSaving(false);
    }
  }, []);

  const saveSnapshot = useCallback(async (snapshot: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      const res = await appendAiUsageSnapshot(snapshot);
      setData(res.state || EMPTY_STATE);
      return res.snapshot;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setSaving(false);
    }
  }, []);

  const testConnection = useCallback(async (config: Record<string, unknown>) => {
    setTesting(true);
    setError(null);
    try {
      return await testAiUsageConnection(config);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setTesting(false);
    }
  }, []);

  const syncAccount = useCallback(async (accountId: string) => {
    setSyncingAccountId(accountId);
    setError(null);
    try {
      const res = await syncAiUsageAccount(accountId);
      setData(res.state || EMPTY_STATE);
      return res;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setSyncingAccountId(null);
    }
  }, []);

  const syncAllAccounts = useCallback(async (accountIds: string[]) => {
    setSyncingAccountId('all');
    setError(null);
    try {
      const results: { accountId: string; ok: boolean; error?: string }[] = [];
      for (const accountId of accountIds) {
        try {
          await syncAiUsageAccount(accountId);
          results.push({ accountId, ok: true });
        } catch (e) {
          results.push({
            accountId,
            ok: false,
            error: e instanceof Error ? e.message : String(e)
          });
        }
      }
      const state = await fetchAiUsageState();
      setData(state || EMPTY_STATE);
      return results;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setSyncingAccountId(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    data,
    loading,
    saving,
    testing,
    syncingAccountId,
    error,
    refresh,
    saveAccount,
    saveSnapshot,
    testConnection,
    syncAccount,
    syncAllAccounts
  };
}