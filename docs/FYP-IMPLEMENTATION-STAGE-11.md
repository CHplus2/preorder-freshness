# Stage 11: owner preparation-time preview

The recipe editor now includes **Try a sample order** below the preparation steps. Enter a sample portion count to see batch count, partial-batch quantity, total step time, hands-on time and each uninterrupted step duration. Calculations reflect unsaved recipe edits and do not create an order or reserve capacity.

The preview implements both duration policies: combined steps use first-batch minutes plus additional-batch minutes; independent batches repeat full first-batch minutes for every batch, including the final partial batch. Basic cook/pack estimates are supported when no detailed tasks exist.

Warnings identify steps longer than the saved kitchen work window, no hands-on steps, quantities above daily capacity and more than 100 independent batches. Unknown kitchen hours omit the daily-window check. Incomplete inputs show an explanatory message rather than a misleading zero result. The sample field is not saved as recipe data and does not block saving otherwise valid menu settings.

This is an arithmetic configuration aid, not a second scheduler or a guarantee of availability. It excludes existing bookings, closures, overlap optimization, waiting limits and lead time. The checkout availability endpoint remains authoritative for a requested delivery time. No live recipe settings or database schema were changed.

Validation: all 34 frontend utility tests passed, including six new examples covering the ten-bar calculation, independent partial batches, basic packing, incomplete values, overnight steps and missing kitchen hours. New-module lint, production build and diff checks passed. Browser layout and editor interaction remain unverified.
