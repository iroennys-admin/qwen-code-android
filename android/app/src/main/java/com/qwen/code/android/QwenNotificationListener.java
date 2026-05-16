package com.qwen.code.android;

import android.app.Notification;
import android.content.Intent;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;

import java.util.ArrayList;
import java.util.List;

/**
 * QwenNotificationListener - Reads device notifications.
 * 
 * Allows the AI agent to:
 * - Read all active notifications
 * - Get notification content (title, text, package)
 * - Dismiss notifications
 * - Listen for new notifications
 */
public class QwenNotificationListener extends NotificationListenerService {

    private static final String TAG = "QwenNotification";
    private static QwenNotificationListener instance;
    private static final List<JSObject> recentNotifications = new ArrayList<>();
    private static final int MAX_NOTIFICATIONS = 100;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        Log.d(TAG, "Notification Listener created");
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        instance = null;
        Log.d(TAG, "Notification Listener destroyed");
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            JSObject notif = parseNotification(sbn);
            synchronized (recentNotifications) {
                recentNotifications.add(0, notif);
                if (recentNotifications.size() > MAX_NOTIFICATIONS) {
                    recentNotifications.remove(recentNotifications.size() - 1);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error parsing notification: " + e.getMessage());
        }
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        // Notification was dismissed
    }

    public static QwenNotificationListener getInstance() {
        return instance;
    }

    public static boolean isRunning() {
        return instance != null;
    }

    /**
     * Get all active notifications
     */
    public JSArray getActiveNotifications() {
        JSArray result = new JSArray();
        try {
            StatusBarNotification[] notifications = getActiveStatusBarNotifications();
            if (notifications != null) {
                for (StatusBarNotification sbn : notifications) {
                    try {
                        JSObject notif = parseNotification(sbn);
                        result.put(notif);
                    } catch (Exception e) {
                        // Skip this notification
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error getting notifications: " + e.getMessage());
        }
        return result;
    }

    /**
     * Get recent notifications that were captured
     */
    public JSArray getRecentNotifications(int limit) {
        JSArray result = new JSArray();
        synchronized (recentNotifications) {
            int count = Math.min(limit, recentNotifications.size());
            for (int i = 0; i < count; i++) {
                result.put(recentNotifications.get(i));
            }
        }
        return result;
    }

    /**
     * Dismiss a notification
     */
    public boolean dismissNotification(String key) {
        try {
            StatusBarNotification[] notifications = getActiveStatusBarNotifications();
            if (notifications != null) {
                for (StatusBarNotification sbn : notifications) {
                    if (sbn.getKey().equals(key)) {
                        cancelNotification(key);
                        return true;
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error dismissing notification: " + e.getMessage());
        }
        return false;
    }

    /**
     * Dismiss all notifications
     */
    public boolean dismissAllNotifications() {
        try {
            cancelAllNotifications();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private JSObject parseNotification(StatusBarNotification sbn) {
        JSObject notif = new JSObject();
        notif.put("key", sbn.getKey());
        notif.put("packageName", sbn.getPackageName());
        notif.put("postTime", sbn.getPostTime());
        notif.put("isOngoing", sbn.isOngoing());
        notif.put("isClearable", sbn.isClearable());

        Notification notification = sbn.getNotification();
        if (notification != null) {
            Bundle extras = notification.extras;
            if (extras != null) {
                CharSequence title = extras.getCharSequence(Notification.EXTRA_TITLE);
                CharSequence text = extras.getCharSequence(Notification.EXTRA_TEXT);
                CharSequence bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
                CharSequence subText = extras.getCharSequence(Notification.EXTRA_SUB_TEXT);
                CharSequence infoText = extras.getCharSequence(Notification.EXTRA_INFO_TEXT);

                if (title != null) notif.put("title", title.toString());
                if (text != null) notif.put("text", text.toString());
                if (bigText != null) notif.put("bigText", bigText.toString());
                if (subText != null) notif.put("subText", subText.toString());
                if (infoText != null) notif.put("infoText", infoText.toString());
                
                // Get app name (we'll use package name)
                notif.put("appName", sbn.getPackageName());
            }
        }

        return notif;
    }
}
