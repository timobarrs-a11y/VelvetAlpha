import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mail = vi.hoisted(() => ({
  getMyMail: vi.fn(),
  markLetterRead: vi.fn(),
  markAllMailRead: vi.fn(),
  sendTownLetter: vi.fn(),
}));
vi.mock('../../../services/townMailService', () => mail);

import { MailboxSheet } from '../MailboxSheet';

const letter = (over: Record<string, unknown> = {}) => ({
  id: 'l1', sender_label: 'Velvet', subject: 'Welcome to town', body: 'The mailbox is open.',
  created_at: '2026-10-27T12:00:00Z', read_at: null, ...over,
});

const setup = (props: Partial<Parameters<typeof MailboxSheet>[0]> = {}) => {
  const onUnreadChange = vi.fn();
  render(<MailboxSheet myId="me" myName="Elvis" canSend={false} onClose={() => {}} onUnreadChange={onUnreadChange} {...props} />);
  return { onUnreadChange };
};

describe('MailboxSheet', () => {
  beforeEach(() => {
    Object.values(mail).forEach((f) => f.mockReset());
    mail.markLetterRead.mockResolvedValue(undefined);
    mail.markAllMailRead.mockResolvedValue(undefined);
  });

  it('shows the unread count and reports it', async () => {
    mail.getMyMail.mockResolvedValue([letter(), letter({ id: 'l2', read_at: '2026-10-27T13:00:00Z' })]);
    const { onUnreadChange } = setup();
    expect(await screen.findByText('1 unread')).toBeTruthy();
    expect(onUnreadChange).toHaveBeenCalledWith(1);
  });

  it('opens a letter as stationery with To, the date and From, and marks it read', async () => {
    mail.getMyMail.mockResolvedValue([letter()]);
    const { onUnreadChange } = setup();
    fireEvent.click(await screen.findByText('Welcome to town'));
    expect(await screen.findByText('Elvis')).toBeTruthy();
    expect(screen.getByText(/To:/)).toBeTruthy();
    expect(screen.getByText(/From:/)).toBeTruthy();
    expect(screen.getByText('Velvet')).toBeTruthy();
    expect(screen.getByText(/Dear Elvis,/)).toBeTruthy();
    expect(screen.getByText(/The mailbox is open\./)).toBeTruthy();
    expect(screen.getByText(/October 27, 2026/)).toBeTruthy();
    await waitFor(() => expect(mail.markLetterRead).toHaveBeenCalledWith('l1'));
    expect(onUnreadChange).toHaveBeenLastCalledWith(0);
    fireEvent.click(screen.getByText('Back to the mailbox'));
    expect(await screen.findByText('Nothing new')).toBeTruthy();
  });

  it('has no way to reply, and only admins can write', async () => {
    mail.getMyMail.mockResolvedValue([letter()]);
    setup();
    fireEvent.click(await screen.findByText('Welcome to town'));
    expect(screen.queryByText(/reply/i)).toBeNull();
    expect(screen.queryByText('Write a letter')).toBeNull();
  });

  it('lets an admin write and send a letter', async () => {
    mail.getMyMail.mockResolvedValue([]);
    mail.sendTownLetter.mockResolvedValue(1);
    setup({ canSend: true });
    fireEvent.click(await screen.findByText('Write a letter'));
    fireEvent.change(screen.getByLabelText('Letter'), { target: { value: 'Hello neighbor' } });
    fireEvent.click(screen.getByText('Send'));
    await waitFor(() => expect(mail.sendTownLetter).toHaveBeenCalledWith('', 'Hello neighbor', ['me']));
    expect(await screen.findByText('Sent 1 letter.')).toBeTruthy();
  });

  it('says so when the mailbox is empty', async () => {
    mail.getMyMail.mockResolvedValue([]);
    setup();
    expect(await screen.findByText('No letters yet.')).toBeTruthy();
  });
});
