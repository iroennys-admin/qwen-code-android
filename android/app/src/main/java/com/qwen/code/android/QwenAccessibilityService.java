package com.qwen.code.android;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.Intent;
import android.graphics.Path;
import android.graphics.Rect;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;

import org.json.JSONException;

import java.util.ArrayList;
import java.util.List;

/**
 * QwenAccessibilityService - Enables UI automation on the device.
 * 
 * Capabilities:
 * - Read screen text content from any app
 * - Click on UI elements by text or coordinates
 * - Type text into input fields
 * - Perform swipe gestures
 * - Navigate between apps
 * - Find and interact with specific UI elements
 */
public class QwenAccessibilityService extends AccessibilityService {

    private static final String TAG = "QwenAccessibility";
    private static QwenAccessibilityService instance;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        Log.d(TAG, "Accessibility Service created");
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        instance = null;
        Log.d(TAG, "Accessibility Service destroyed");
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // We don't need to react to events automatically
    }

    @Override
    public void onInterrupt() {
        Log.d(TAG, "Accessibility Service interrupted");
    }

    public static QwenAccessibilityService getInstance() {
        return instance;
    }

    public static boolean isRunning() {
        return instance != null;
    }

    /**
     * Read all visible text on the current screen
     */
    public JSObject readScreen() {
        JSObject result = new JSObject();
        try {
            AccessibilityNodeInfo rootNode = getRootInActiveWindow();
            if (rootNode == null) {
                result.put("text", "");
                result.put("error", "No active window");
                return result;
            }

            StringBuilder screenText = new StringBuilder();
            JSArray elements = new JSArray();
            collectTextFromNode(rootNode, screenText, elements, 0);

            result.put("text", screenText.toString().trim());
            result.put("elements", elements);
            
            // Get current package name
            if (rootNode.getPackageName() != null) {
                result.put("packageName", rootNode.getPackageName().toString());
            }

            rootNode.recycle();
        } catch (Exception e) {
            result.put("text", "");
            result.put("error", e.getMessage());
        }
        return result;
    }

    private void collectTextFromNode(AccessibilityNodeInfo node, StringBuilder textBuilder, JSArray elements, int depth) {
        if (node == null || depth > 30) return;

        CharSequence nodeText = node.getText();
        CharSequence contentDesc = node.getContentDescription();
        CharSequence hint = node.getHintText();
        
        if (nodeText != null && nodeText.length() > 0) {
            textBuilder.append(nodeText).append("\n");
            
            try {
                JSObject elem = new JSObject();
                elem.put("text", nodeText.toString());
                if (contentDesc != null) elem.put("contentDescription", contentDesc.toString());
                elem.put("className", node.getClassName() != null ? node.getClassName().toString() : "");
                elem.put("clickable", node.isClickable());
                elem.put("editable", node.isEditable());
                elem.put("focusable", node.isFocusable());
                
                Rect bounds = new Rect();
                node.getBoundsInScreen(bounds);
                elem.put("bounds", bounds.flattenToString());
                
                elements.put(elem);
            } catch (Exception e) {
                // Skip this element
            }
        }

        if (nodeText == null && contentDesc != null && contentDesc.length() > 0) {
            textBuilder.append(contentDesc).append("\n");
        }

        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                collectTextFromNode(child, textBuilder, elements, depth + 1);
                child.recycle();
            }
        }
    }

    /**
     * Click on a node that contains the specified text
     */
    public JSObject clickText(String searchText, boolean exactMatch) {
        JSObject result = new JSObject();
        try {
            AccessibilityNodeInfo rootNode = getRootInActiveWindow();
            if (rootNode == null) {
                result.put("value", false);
                result.put("error", "No active window");
                return result;
            }

            List<AccessibilityNodeInfo> nodes = findNodesByText(rootNode, searchText, exactMatch);
            
            if (nodes.isEmpty()) {
                result.put("value", false);
                result.put("error", "Text not found: " + searchText);
                rootNode.recycle();
                return result;
            }

            boolean clicked = false;
            for (AccessibilityNodeInfo node : nodes) {
                if (performClick(node)) {
                    clicked = true;
                    break;
                }
            }

            for (AccessibilityNodeInfo node : nodes) {
                node.recycle();
            }

            result.put("value", clicked);
            if (!clicked) {
                result.put("error", "Found text but could not click");
            }
            rootNode.recycle();
        } catch (Exception e) {
            result.put("value", false);
            result.put("error", e.getMessage());
        }
        return result;
    }

    /**
     * Click at specific coordinates
     */
    public JSObject clickAt(int x, int y) {
        JSObject result = new JSObject();
        try {
            Path clickPath = new Path();
            clickPath.moveTo(x, y);
            
            GestureDescription.StrokeDescription stroke = new GestureDescription.StrokeDescription(clickPath, 0, 100);
            GestureDescription gesture = new GestureDescription.Builder().addStroke(stroke).build();
            
            boolean dispatched = dispatchGesture(gesture, null, null);
            result.put("value", dispatched);
        } catch (Exception e) {
            result.put("value", false);
            result.put("error", e.getMessage());
        }
        return result;
    }

    /**
     * Type text into the currently focused input field
     */
    public JSObject typeText(String text) {
        JSObject result = new JSObject();
        try {
            AccessibilityNodeInfo rootNode = getRootInActiveWindow();
            if (rootNode == null) {
                result.put("value", false);
                result.put("error", "No active window");
                return result;
            }

            AccessibilityNodeInfo focusNode = findFocusNode(rootNode);
            if (focusNode != null && focusNode.isEditable()) {
                Bundle args = new Bundle();
                args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text);
                focusNode.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args);
                result.put("value", true);
                focusNode.recycle();
            } else {
                // Try using clipboard paste
                result.put("value", false);
                result.put("error", "No editable field focused. Try clicking on an input field first.");
            }
            rootNode.recycle();
        } catch (Exception e) {
            result.put("value", false);
            result.put("error", e.getMessage());
        }
        return result;
    }

    /**
     * Perform a swipe gesture
     */
    public JSObject swipe(int startX, int startY, int endX, int endY, int durationMs) {
        JSObject result = new JSObject();
        try {
            Path swipePath = new Path();
            swipePath.moveTo(startX, startY);
            swipePath.lineTo(endX, endY);
            
            GestureDescription.StrokeDescription stroke = new GestureDescription.StrokeDescription(swipePath, 0, durationMs);
            GestureDescription gesture = new GestureDescription.Builder().addStroke(stroke).build();
            
            boolean dispatched = dispatchGesture(gesture, null, null);
            result.put("value", dispatched);
        } catch (Exception e) {
            result.put("value", false);
            result.put("error", e.getMessage());
        }
        return result;
    }

    /**
     * Press back button
     */
    public JSObject pressBack() {
        JSObject result = new JSObject();
        result.put("value", performGlobalAction(GLOBAL_ACTION_BACK));
        return result;
    }

    /**
     * Press home button
     */
    public JSObject pressHome() {
        JSObject result = new JSObject();
        result.put("value", performGlobalAction(GLOBAL_ACTION_HOME));
        return result;
    }

    /**
     * Press recents button
     */
    public JSObject pressRecents() {
        JSObject result = new JSObject();
        result.put("value", performGlobalAction(GLOBAL_ACTION_RECENTS));
        return result;
    }

    /**
     * Open notifications panel
     */
    public JSObject openNotifications() {
        JSObject result = new JSObject();
        result.put("value", performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS));
        return result;
    }

    /**
     * Open quick settings
     */
    public JSObject openQuickSettings() {
        JSObject result = new JSObject();
        result.put("value", performGlobalAction(GLOBAL_ACTION_QUICK_SETTINGS));
        return result;
    }

    /**
     * Get current app info
     */
    public JSObject getCurrentApp() {
        JSObject result = new JSObject();
        try {
            AccessibilityNodeInfo rootNode = getRootInActiveWindow();
            if (rootNode != null) {
                if (rootNode.getPackageName() != null) {
                    result.put("packageName", rootNode.getPackageName().toString());
                }
                rootNode.recycle();
            }
        } catch (Exception e) {
            result.put("error", e.getMessage());
        }
        return result;
    }

    // Helper methods

    private List<AccessibilityNodeInfo> findNodesByText(AccessibilityNodeInfo rootNode, String text, boolean exactMatch) {
        List<AccessibilityNodeInfo> results = new ArrayList<>();
        findNodesByTextRecursive(rootNode, text, exactMatch, results);
        return results;
    }

    private void findNodesByTextRecursive(AccessibilityNodeInfo node, String text, boolean exactMatch, List<AccessibilityNodeInfo> results) {
        if (node == null || results.size() >= 5) return;

        CharSequence nodeText = node.getText();
        CharSequence contentDesc = node.getContentDescription();

        boolean matches = false;
        if (exactMatch) {
            matches = (nodeText != null && nodeText.toString().equals(text)) ||
                      (contentDesc != null && contentDesc.toString().equals(text));
        } else {
            matches = (nodeText != null && nodeText.toString().toLowerCase().contains(text.toLowerCase())) ||
                      (contentDesc != null && contentDesc.toString().toLowerCase().contains(text.toLowerCase()));
        }

        if (matches) {
            results.add(AccessibilityNodeInfo.obtain(node));
        }

        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                findNodesByTextRecursive(child, text, exactMatch, results);
                child.recycle();
            }
        }
    }

    private boolean performClick(AccessibilityNodeInfo node) {
        if (node == null) return false;

        if (node.isClickable()) {
            return node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
        }

        // Try clicking parent
        AccessibilityNodeInfo parent = node.getParent();
        if (parent != null) {
            boolean clicked = performClick(parent);
            parent.recycle();
            return clicked;
        }

        return false;
    }

    private AccessibilityNodeInfo findFocusNode(AccessibilityNodeInfo node) {
        if (node == null) return null;
        if (node.isEditable() && node.isFocused()) return node;

        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                AccessibilityNodeInfo found = findFocusNode(child);
                if (found != null) {
                    if (found != child) child.recycle();
                    return found;
                }
                child.recycle();
            }
        }
        return null;
    }
}
