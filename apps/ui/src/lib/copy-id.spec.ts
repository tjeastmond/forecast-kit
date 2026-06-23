import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { copyId } from './copy-id.js';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('copyId', () => {
  const writeText = vi.fn();

  beforeEach(() => {
    writeText.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
    vi.stubGlobal('navigator', {
      clipboard: { writeText },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('copies the value and shows a success toast', async () => {
    writeText.mockResolvedValue(undefined);

    await copyId('KXBTC15M-26JUN231400-00', 'Market ID');

    expect(writeText).toHaveBeenCalledWith('KXBTC15M-26JUN231400-00');
    expect(toast.success).toHaveBeenCalledWith('Market ID copied');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows an error toast when clipboard write fails', async () => {
    writeText.mockRejectedValue(new Error('denied'));

    await copyId('KXELONMARS-99', 'Event ID');

    expect(toast.error).toHaveBeenCalledWith('Failed to copy event id');
    expect(toast.success).not.toHaveBeenCalled();
  });
});
