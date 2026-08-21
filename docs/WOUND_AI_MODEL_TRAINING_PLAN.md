# WoundHeal AI Model Training Plan

## Purpose

This guide explains, in beginner-friendly terms, how to create a separate computer-vision model that finds a wound, labels visible tissue regions, and calculates tissue percentages.

The existing WoundHeal **Model Lab** does not currently train or update a model. It sends images to existing AI providers, compares their responses, and stores expert reviews. This is useful for building and evaluating a dataset, but saved feedback does not automatically change Claude, Gemini, OpenAI, or another provider.

## Recommended beginner workflow

```text
Collect permitted wound images
        ↓
Doctors label the visible tissue regions
        ↓
Upload images and labels to Roboflow
        ↓
Train a semantic-segmentation model
        ↓
Test it on patients it has never seen
        ↓
Connect its protected API to WoundHeal
        ↓
Clinicians review every prediction
        ↓
Approved corrections form the next dataset version
```

## Phase 1: Define the first model

The first model should only:

- Locate the visible wound bed.
- Mark visible tissue regions.
- Calculate the percentage of each tissue class.

Use these tissue classes:

1. `granulation`
2. `slough_fibrin`
3. `eschar_necrotic`
4. `epithelial`
5. `unclassifiable`

The complete wound boundary is the combined area of the tissue masks. Do not initially train the model to diagnose infection or ischemia, select treatment, or infer pain, odor, temperature, depth, tunneling, induration, perfusion, or other bedside-only findings.

## Phase 2: Obtain suitable images

Start with approximately 100–300 images to test the workflow. This is only a proof of concept, not a clinically validated product. A production-quality model will likely require a substantially larger and more diverse dataset.

For every image, record:

- A unique case ID.
- Proof of consent, permission, or a licence that permits machine-learning use.
- Body site and laterality.
- Wound type, when clinically established.
- Skin-tone group.
- Capture date and device type, when available.
- Whether the wound was cleansed before capture.
- Whether a calibration marker is present.
- Clinician reviewer identity.
- Original clinician note.

Do not upload identifiable patient images to third-party platforms until appropriate privacy, security, legal, and contractual reviews are complete. For early experiments, use properly licensed, de-identified research images. A normal stock-photo licence may not permit machine-learning training.

## Phase 3: Create the Roboflow project

1. Create an account at <https://roboflow.com/>.
2. Select **Create New Project**.
3. Name it `WoundHeal Tissue Segmentation`.
4. Choose **Semantic Segmentation**.
5. Keep the project private.
6. Add the five tissue classes listed above.

Semantic segmentation assigns a tissue class to each image pixel. This allows tissue percentages to be calculated from the completed masks instead of estimated only from prose.

## Phase 4: Run a small annotation pilot

Upload only 20–30 images first. Ask a wound-care clinician to annotate five images before processing the whole pilot.

For each image, the clinician should:

1. Mark whether the image is assessable, partially assessable, or unassessable.
2. Use the polygon or mask tool.
3. Draw every visible granulation region and label it `granulation`.
4. Draw every visible slough/fibrin region and label it `slough_fibrin`.
5. Draw every visible eschar/necrotic region and label it `eschar_necrotic`.
6. Draw visible epithelial tissue and label it `epithelial`.
7. Mark obscured or genuinely uncertain regions as `unclassifiable`.
8. Ensure the entire visible wound bed is covered by one of these classes.
9. Leave normal and periwound skin outside the wound bed unlabelled.
10. Review the calculated percentages for clinical plausibility.

Written notes should be retained, but the masks are what teach a segmentation model where each tissue category appears.

## Clinician annotation record

Store the following alongside every annotated image:

```text
Image assessability: yes / partial / no
Limitation reason:
Reviewer confidence: high / moderate / low

Body site:
Laterality:
Clinically established wound type:
Skin-tone group:

Granulation percentage:
Slough/fibrin percentage:
Eschar/necrotic percentage:
Epithelial percentage:
Unclassifiable percentage:
Total: 100%

Visible wound-edge findings:
Visible periwound findings:
Visible infection-associated features:
Features that cannot be determined from the image:

Original clinician note:
```

Percentages should normally use 5% or 10% increments during manual review and must cover the wound bed only. Do not include surrounding skin. Allow `unclassifiable` rather than forcing uncertain regions into an incorrect class.

## Phase 5: Obtain independent expert review

For at least 20–30% of the images:

1. Doctor A annotates without seeing an AI prediction.
2. Doctor B reviews or independently annotates the same image.
3. Significant disagreements are discussed.
4. An agreed annotation is saved as adjudicated ground truth.

Do not treat one clinician's estimate as perfect ground truth. Track the original annotations, the adjudicated version, reviewer identities, dates, and reasons for changes.

## Phase 6: Split the dataset by patient

Create three groups:

- Training: approximately 70%.
- Validation: approximately 15%.
- Locked test set: approximately 15%.

All images belonging to the same patient must remain in only one group. Never place one visit from a patient in training and another visit from that patient in testing. Otherwise, results may look artificially strong because the model has effectively seen that wound before.

The locked test set must not be used to adjust labels, prompts, training settings, or model selection.

## Phase 7: Generate a dataset version

In Roboflow:

1. Open the project.
2. Select **Generate** or **Create Dataset Version**.
3. Enable auto-orientation.
4. Choose a consistent image size, initially 640 or 768 pixels.
5. Keep color processing clinically realistic.
6. Generate and permanently identify the dataset version.

Possible pilot augmentations include small rotations, modest crops, limited brightness changes, and slight blur representing real capture conditions. Avoid aggressive hue, saturation, or color changes because tissue assessment relies heavily on color. A clinical reviewer should approve augmentation settings.

## Phase 8: Train the pilot model

1. Open the generated dataset version.
2. Select **Train**.
3. Start from a public or pretrained checkpoint.
4. Use a small or medium model for the first experiment.
5. Keep a record of the dataset version, model configuration, training date, and software version.
6. Start training and wait for completion.

This is the point at which a model is actually trained: it repeatedly compares its predicted masks with clinician-approved masks and adjusts its internal weights to reduce the error.

## Phase 9: Evaluate the model

Do not rely only on a single overall accuracy score. Review:

- Wound-boundary overlap.
- Per-class Dice score or Intersection over Union.
- Precision and recall for every tissue class.
- Error in calculated tissue percentages.
- Performance by wound type, body site, skin tone, country, clinic, camera, and image quality.
- Confusion between slough and eschar.
- Confusion between granulation and surrounding red skin.
- Performance with glare, shadows, hair, blood, dressings, and poor focus.
- Ability to flag unassessable or unclassifiable input.

Clinicians should visually review test-set overlays. The test set must contain only patients absent from training and validation.

## Phase 10: Connect the model to WoundHeal

Roboflow will provide a model identifier, version, API endpoint, and API key. The integration should be:

```text
WoundHeal browser
        ↓
Protected Vercel server API
        ↓
Segmentation model API
        ↓
Tissue masks and confidence values
        ↓
Server calculates tissue percentages
        ↓
WoundHeal displays draft suggestions
        ↓
Clinician confirms or corrects the result
```

Never expose the private model API key in browser code. Store it as a protected Vercel environment variable. Predictions must remain draft suggestions until a qualified clinician confirms them.

Record with every prediction:

- Model provider and model version.
- Dataset version used for training.
- Original prediction and confidence.
- Image-quality result.
- Clinician correction.
- Reviewer identity and timestamp.
- Final confirmed record.

## Phase 11: Improve the model safely

The model must not silently retrain after every correction. Use controlled versions:

1. Save clinician corrections.
2. Review and adjudicate them.
3. Add approved cases to a new dataset version.
4. Train model version 2.
5. Evaluate it against the same locked test set.
6. Compare it with the current production model.
7. Promote it only when predefined acceptance criteria are met and important subgroups do not regress.
8. Retain the ability to roll back to the prior version.

## How the existing Model Lab fits

The WoundHeal Model Lab currently supports provider comparison and expert review. It should eventually add:

- Structured editable ground-truth fields.
- The `unclassifiable` tissue category.
- Image assessability and confidence.
- Wound-boundary and tissue-mask drawing.
- Independent review and adjudication status.
- Dataset consent/licence status.
- Patient-grouped train, validation, and test assignment.
- Dataset export for training.
- Model-result import.
- Versioned accuracy and subgroup reports.

Until those capabilities exist, use WoundHeal to organize and compare cases and use Roboflow for mask annotation and pilot training.

## Optional later path: Google Colab

Google Colab is not required for the first no-code experiment. Later, the approved dataset can be exported and a developer can train a PyTorch or Ultralytics semantic-segmentation model in Colab. Colab provides notebook-based access to GPUs without requiring a local machine-learning installation, but availability and runtime limits vary.

## Immediate checklist

- [ ] Create a private semantic-segmentation project in Roboflow.
- [ ] Add the five tissue classes.
- [ ] Confirm privacy and image-training rights.
- [ ] Collect 20–30 pilot images.
- [ ] Write and approve the clinical labeling definitions.
- [ ] Ask a clinician to annotate five images.
- [ ] Have a second clinician independently review several images.
- [ ] Fix unclear annotation instructions.
- [ ] Complete the pilot annotations.
- [ ] Split cases by patient.
- [ ] Generate dataset version 1.
- [ ] Train a small experimental model.
- [ ] Evaluate it on the locked test patients.
- [ ] Keep it out of live clinical decision-making until independently validated.

## Reference documentation

- Roboflow annotation: <https://docs.roboflow.com/annotate/use-roboflow-annotate>
- Roboflow training: <https://docs.roboflow.com/train>
- Google Colab FAQ: <https://research.google.com/colaboratory/faq.html>
- Ultralytics semantic segmentation: <https://docs.ultralytics.com/tasks/semantic>
- FDA digital-health guidance collection: <https://www.fda.gov/medical-devices/digital-health-center-excellence/guidances-digital-health-content>

