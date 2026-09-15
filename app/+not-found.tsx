import { Link, Stack, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import React, { useEffect } from 'react';

export default function NotFoundScreen() {
  const router = useRouter();

  useEffect(() => {
    // Prevent wiping out navigation state if opened via notification
    if (router.canGoBack()) {
      router.back();
    } else {
      // Use push instead of replace to preserve any underlying state if possible
      router.push('/');
    }
  }, [router]);

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
