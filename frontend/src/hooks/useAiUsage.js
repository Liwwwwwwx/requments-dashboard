import { useCallback, useEffect, useState } from 'react';
import {
  appendAiUsageSnapshot,
  fetchAiUsageState,
  saveAiUsageAccount,
  syncAiUsageAccount,
  testAiUsageConnection
} from '../api';

const EMPTY_STATE = {
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

export function useAiUsage() {
  const [data, setData] = useState(EMPTY_STATE);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncingAccountId, setSyncingAccountId] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const state = await fetchAiUsageState();
      setData(state || EMPTY_STATE);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveAccount = useCallback(async (account) => {
    setSaving(true);
    setError(null);
    try {
      const res = await saveAiUsageAccount(account);
      setData(res.state || EMPTY_STATE);
      return res.account;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setSaving(false);
    }
  }, []);

  const saveSnapshot = useCallback(async (snapshot) => {
    setSaving(true);
    setError(null);
    try {
      const res = await appendAiUsageSnapshot(snapshot);
      setData(res.state || EMPTY_STATE);
      return res.snapshot;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setSaving(false);
    }
  }, []);

  const testConnection = useCallback(async (config) => {
    setTesting(true);
    setError(null);
    try {
      return await testAiUsageConnection(config);
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setTesting(false);
    }
  }, []);

  const syncAccount = useCallback(async (accountId) => {
    setSyncingAccountId(accountId);
    setError(null);
    try {
      const res = await syncAiUsageAccount(accountId);
      setData(res.state || EMPTY_STATE);
      return res;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setSyncingAccountId(null);
    }
  }, []);

  const syncAllAccounts = useCallback(async (accountIds) => {
    setSyncingAccountId('all');
    setError(null);
    try {
      const results = [];
      for (const accountId of accountIds) {
        try {
          results.push({ accountId, ok: true, result: await syncAiUsageAccount(accountId) });
        } catch (e) {
          results.push({ accountId, ok: false, error: e.message });
        }
      }
      const state = await fetchAiUsageState();
      setData(state || EMPTY_STATE);
      return results;
    } catch (e) {
      setError(e.message);
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
