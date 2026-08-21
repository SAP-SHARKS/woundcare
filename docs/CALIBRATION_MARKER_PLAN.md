# Wound Image Calibration Marker Plan

## Purpose

Build a deterministic calibration pipeline for wound photographs. This pipeline is separate from the clinical AI model and must not invent measurements that were not obtained from the image, a physical reference, or validated device sensors.

The first useful release should focus on marker-based planar scaling. Exact camera distance and angle can follow after device-camera calibration is available.

## Phase 1: Physical marker

Create a standardized ArUco-style square marker with:

- An outer dimension of exactly 20 mm × 20 mm.
- A unique marker ID and version.
- High-contrast black and white printing.
- Matte, wipeable or disposable material.
- A clear instruction to place it flat in the same plane as the wound.
- A printable PDF that must be printed at 100% scale.
- A printed ruler check so staff can verify the physical size.
- A lot or batch identifier if physical markers are manufactured.

The marker should be positioned near the wound without covering the wound or clinically important periwound skin.

## Phase 2: Live marker detection

Run deterministic computer-vision processing locally during camera capture, preferably through OpenCV.js or WebAssembly so it can work offline.

For every live frame:

1. Detect the marker ID.
2. Locate all four corners.
3. Confirm the complete marker is visible.
4. Calculate detection and corner confidence.
5. Calculate perspective distortion or reprojection error.
6. Reject partly obscured, folded, curved or poorly detected markers.
7. Display live guidance such as:
   - Marker detected.
   - Move closer.
   - Move farther away.
   - Hold the camera flatter.
   - Marker partly obscured.
   - Reduce glare.

## Phase 3: Planar scale

Use the four detected corners and the known 20 mm dimensions to calculate a homography. Rectify the marker/wound plane and calculate pixels per millimetre.

This supports calibrated two-dimensional wound measurements when:

- The marker is fully visible.
- The marker is flat.
- The marker is coplanar with the wound.
- Perspective error is within the validated threshold.
- The wound and required periwound margin are visible.

If these requirements are not satisfied, the photograph may remain usable for visible-feature documentation, but centimetre measurements must be withheld.

## Calibration metadata

Store the original image separately from derived images and outputs. Suggested metadata:

```json
{
  "marker_id": 1,
  "marker_version": "woundheal-20mm-v1",
  "marker_size_mm": 20,
  "corners_px": [],
  "homography": [],
  "pixels_per_mm": 8.42,
  "reprojection_error": 0.7,
  "calibration_status": "accepted",
  "rejection_reasons": [],
  "algorithm_version": "marker-calibration-v1"
}
```

Do not hard-code the example numeric values above into the interface. They must come from the processed image.

## Deterministic quality checks

These checks should not be delegated to a language model:

- Marker detection and visibility.
- Marker size within the frame.
- Marker perspective distortion.
- Sharpness/focus score.
- Underexposure and overexposure.
- Clipped highlights and glare.
- Image dimensions and compression quality.
- Wound/periwound coverage, initially confirmed by the clinician.

Thresholds must be explicit, versioned and validated. Every rejection should store a reason code.

## Wound segmentation and measurement

Segmentation is a separate stage after calibration passes:

1. Produce a proposed wound-boundary mask.
2. Overlay it on the original image.
3. Let the clinician accept or edit the boundary.
4. Save both the original proposal and clinician-confirmed mask.
5. Transform the accepted mask into the rectified plane.
6. Calculate length, width and area using the marker-derived scale.
7. Store model, prompt/algorithm and calibration versions.

The clinician-confirmed boundary—not the initial AI proposal—should become the authoritative measurement.

## Phase 4: Distance and perpendicularity

Exact camera distance and 3D angle require camera intrinsic parameters, distortion coefficients and marker-pose estimation.

For supported camera profiles:

1. Calibrate the camera with a ChArUco or equivalent calibration board.
2. Store the camera matrix and lens-distortion coefficients.
3. Use marker corners and pose estimation to calculate rotation and translation.
4. Convert translation to camera-to-marker distance.
5. Convert rotation to perpendicularity/angle guidance.

For an unknown camera profile, the interface should show visual positioning guidance but label numeric distance and angle as unavailable.

## Colour and white balance

A black-and-white marker does not support a defensible numerical colour-difference or Delta E value.

For calibrated colour in a later phase:

- Add known neutral-grey or colour-reference patches.
- Record reference colour values for the manufactured marker.
- Detect glare and uneven illumination.
- Validate colour correction across supported devices.

Until that validation exists, report exposure and glare checks only. Do not claim numerical colour normalization.

## Validation plan

Validate with wound-shaped phantoms and independently measured ground truth:

- Multiple wound sizes and irregular shapes.
- Capture distances from 20–30 cm.
- Camera angles at 0°, 5°, 10°, 15° and 20°.
- Multiple phone manufacturers and camera models.
- Different image resolutions and compression levels.
- Light and dark surrounding surfaces.
- Low light, overexposure, shadows and glare.
- Fully visible and partially obscured markers.
- Flat versus curved or incorrectly positioned markers.

For each condition, measure:

- Marker detection rate.
- False marker detection rate.
- Length error.
- Width error.
- Area error.
- Repeatability between captures.
- Inter-device variation.
- Quality-gate rejection performance.

Define and document acceptance thresholds before enabling automatic clinical measurements.

## Recommended implementation order

1. Generate and verify the standardized 20 mm marker.
2. Detect marker corners in live camera frames.
3. Calculate homography and pixels per millimetre.
4. Add deterministic blur, exposure and glare checks.
5. Store complete calibration metadata and reason codes.
6. Add clinician-adjustable wound segmentation.
7. Validate measurement accuracy using phantoms.
8. Add supported-device distance and angle estimation.
9. Consider colour-reference calibration only after the measurement pipeline is validated.

## References

- OpenCV ArUco marker detection and pose estimation: https://docs.opencv.org/4.11.0/d5/dae/tutorial_aruco_detection.html
- OpenCV planar homography: https://docs.opencv.org/4.x/d7/dff/tutorial_feature_homography.html
- OpenCV camera calibration: https://docs.opencv.org/4.12.0/dc/d43/tutorial_camera_calibration_square_chess.html

