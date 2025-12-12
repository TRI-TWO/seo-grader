# Calendly Integration QA Test Checklist

**Date:** December 2024  
**Server:** http://localhost:3002  
**Calendly URL:** https://calendly.com/mgr-tri-two

---

## Pre-Test Setup

- [x] Development server running on port 3002
- [ ] Navigate to home page: http://localhost:3002
- [ ] Run a test audit to generate a report page

---

## Test 1: Basic Button Functionality

**Location:** Report page (`/report`)

### Steps:
1. Navigate to a report page (after running an audit)
2. Locate the "Schedule A Consultation Now" button in the right sidebar
3. Verify button is visible and styled correctly (teal background)
4. Click the button

### Expected Results:
- [ ] Button is visible and properly styled
- [ ] Button is clickable
- [ ] Calendly popup opens when button is clicked
- [ ] Popup displays your Calendly scheduling page (mgr-tri-two)
- [ ] Popup is responsive and displays correctly

### Actual Results:
- [ ] Pass
- [ ] Fail (notes: _______________)

---

## Test 2: Calendly Script Loading

### Steps:
1. Open browser DevTools (F12 or Cmd+Option+I)
2. Go to Console tab
3. Navigate to report page
4. Check for any console errors
5. Look for "Calendly widget script loaded" message

### Expected Results:
- [ ] No console errors related to Calendly
- [ ] "Calendly widget script loaded" message appears in console
- [ ] No 404 errors for Calendly script
- [ ] Script loads from: `https://assets.calendly.com/assets/external/widget.js`

### Actual Results:
- [ ] Pass
- [ ] Fail (notes: _______________)

---

## Test 3: Popup Widget Behavior

### Steps:
1. Click "Schedule A Consultation Now" button
2. Observe the popup behavior
3. Try to interact with the Calendly widget
4. Close the popup (click outside or X button)

### Expected Results:
- [ ] Popup opens smoothly
- [ ] Popup is centered and properly sized
- [ ] Calendly scheduling interface is fully functional
- [ ] Can see available time slots
- [ ] Can close popup without errors
- [ ] Page remains functional after closing popup

### Actual Results:
- [ ] Pass
- [ ] Fail (notes: _______________)

---

## Test 4: Mobile Responsiveness

### Steps:
1. Open browser DevTools
2. Enable device emulation (mobile view)
3. Navigate to report page
4. Click "Schedule A Consultation Now" button

### Expected Results:
- [ ] Button is visible on mobile
- [ ] Button is properly sized for mobile
- [ ] Popup opens correctly on mobile
- [ ] Popup is responsive and usable on mobile devices

### Actual Results:
- [ ] Pass
- [ ] Fail (notes: _______________)

---

## Test 5: Multiple Clicks

### Steps:
1. Click "Schedule A Consultation Now" button
2. Close the popup
3. Click the button again
4. Repeat 2-3 times

### Expected Results:
- [ ] Popup opens consistently on each click
- [ ] No errors after multiple opens/closes
- [ ] No memory leaks or performance issues

### Actual Results:
- [ ] Pass
- [ ] Fail (notes: _______________)

---

## Test 6: Network Tab Verification

### Steps:
1. Open browser DevTools
2. Go to Network tab
3. Navigate to report page
4. Filter by "calendly"
5. Click "Schedule A Consultation Now" button

### Expected Results:
- [ ] Calendly script loads successfully (200 status)
- [ ] No failed requests
- [ ] Script loads from correct CDN

### Actual Results:
- [ ] Pass
- [ ] Fail (notes: _______________)

---

## Known Issues / Notes

### Issues Found:
1. _________________________________________________
2. _________________________________________________
3. _________________________________________________

### Browser Compatibility:
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

---

## Test Results Summary

**Overall Status:** [ ] PASS [ ] FAIL [ ] NEEDS WORK

**Critical Issues:** _______________

**Minor Issues:** _______________

**Recommendations:** _______________

---

## Next Steps

If all tests pass:
- [ ] Ready for production deployment
- [ ] Consider setting up webhook for appointment tracking (optional)

If tests fail:
- [ ] Document specific failures
- [ ] Check browser console for errors
- [ ] Verify Calendly account is active
- [ ] Check network connectivity
