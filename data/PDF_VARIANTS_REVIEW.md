# Track 9 PDF Variants Review

This note captures the current behavior of the available statement PDFs when processed through the Track 9 parser and analytics pipeline.

## Current comparison

| PDF | Size | Transactions Parsed | Holdings | Overlap Stocks | Portfolio XIRR | Expense Drag |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `sample_cams.pdf` | 2.0 KB | 8 | 6 | 3 | 12.1% | Rs. 5,644.85 |
| `sample_cams_detailed.pdf` | 6.8 KB | 30 | 6 | 3 | 12.1% | Rs. 5,644.85 |
| `sample_cams_aggressive.pdf` | 80.3 KB | 45 | 4 | 0 | 6.3% | Rs. 0.00 |
| `sample_cams_moderate.pdf` | 80.6 KB | 52 | 4 | 0 | 4.0% | Rs. 0.00 |
| `sample_cams_conservative.pdf` | 77.9 KB | 25 | 3 | 0 | 4.8% | Rs. 0.00 |
| `master_cams_statement.pdf` | 51.9 KB | 299 | 6 | 3 | 12.1% | Rs. 5,644.85 |

## What is working well

- `sample_cams_detailed.pdf` is the safest primary demo PDF right now. It stays small while exercising the full six-fund Scenario C portfolio, including overlap detection, expense drag, and stable XIRR.
- `master_cams_statement.pdf` now parses correctly and reaches the same Scenario C analytics, so it is a strong "full statement" demo input.
- The persona PDFs (`aggressive`, `moderate`, `conservative`) parse cleanly after the row-layout fix, so they remain useful for allocation/FIRE/tax storytelling.

## Current limitations

- The persona PDFs do not currently demonstrate stock-overlap scoring well because they only resolve to 3-4 holdings and do not surface overlapping stocks in the current fixture set.
- `sample_cams.pdf` is now a valid smoke-test file, but it is still too lightweight to showcase the full statement experience by itself.
- Visual clarity matters more in the React app and exported report than in the source CAMS samples, because the source PDFs are statement inputs, not the final user-facing output.

## Recommended final master approach

- Use `sample_cams_detailed.pdf` as the default judge/demo input for Track 9.
- Keep `master_cams_statement.pdf` as the "stress" or "full realism" input.
- Use the aggressive/moderate/conservative PDFs only for persona-specific comparison demos, not as the main overlap demo.
- Treat the exported FinSage report and React portfolio screens as the final presentation layer for overlap score, XIRR formatting, and clearer color separation.
