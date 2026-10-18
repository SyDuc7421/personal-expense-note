import { buildReminder } from './reminder'

const TEMPLATE = 'Ê {name}, tổng kết tí nha 😄\n{items}\nTổng: {total}. Rảnh thì chuyển mình nha!'

test('reproduces the spec sample', () => {
  const text = buildReminder(TEMPLATE, 'Nam', [
    { date: '2026-10-12', note: 'lẩu', remaining: 150000 },
    { date: '2026-10-15', note: 'grab', remaining: 50000 },
  ])
  expect(text).toBe(
    'Ê Nam, tổng kết tí nha 😄\n• 12/10 – Lẩu: 150.000đ\n• 15/10 – Grab: 50.000đ\nTổng: 200.000đ. Rảnh thì chuyển mình nha!',
  )
})

test('empty note omits the label; placeholders may repeat', () => {
  expect(buildReminder('{name} {name}: {items} = {total}', 'Huy', [{ date: '2026-01-05', note: '', remaining: 1000 }])).toBe(
    'Huy Huy: • 05/01: 1.000đ = 1.000đ',
  )
})
