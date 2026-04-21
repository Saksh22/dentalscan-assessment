# AUDIT

The scan flow is intuitive and easy to understand, but it does not give enough user control as it automatically starts the scan without an explicit action. This can catch users off guard and doesn’t give enough time to properly position before capture begins.

Control is also limited after capture. There’s no option to retry or delete a scan, which makes the flow feel rigid. Since this process depends heavily on user positioning, not being able to fix a bad scan increases the chances of submitting poor-quality images.

During capture, there is guidance, but it’s not strong enough. The feedback feels a bit subtle, and users are still left guessing things like distance, centering, and whether the angle is correct. This is more noticeable in the side scans (left/right), which are harder to get right.

From a technical perspective, performance is solid. The camera preview is stable and there’s no noticeable lag. However, there are clear gaps in validation. It was observed that the scans could be submitted even when there is no face visible, and the system still generated an analysis. This points to missing input validation and raises concerns about how reliable the results actually are.

There are also some smaller UI issues, like incorrectly numbered steps and overlapping guidance text, which can make the flow slightly confusing at times.

Overall, the flow works, while lacking in certain areas like control, stronger feedback, and proper validation to make it reliable.