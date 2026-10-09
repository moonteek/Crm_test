/**
 * A student is charged the course's monthly price for every calendar month
 * (fully or partly) they are enrolled in a group. Balance = payments - charges.
 */
type Enrollment = { joinedAt: Date; leftAt: Date | null; group: { course: { price: number } } };

export function monthsEnrolled(joinedAt: Date, leftAt: Date | null, now = new Date()) {
  const end = leftAt && leftAt < now ? leftAt : now;
  if (end < joinedAt) return 0;
  return (end.getFullYear() - joinedAt.getFullYear()) * 12 + (end.getMonth() - joinedAt.getMonth()) + 1;
}

export function totalCharges(enrollments: Enrollment[], now = new Date()) {
  return enrollments.reduce(
    (sum, e) => sum + monthsEnrolled(e.joinedAt, e.leftAt, now) * e.group.course.price,
    0,
  );
}

export function balance(enrollments: Enrollment[], payments: { amount: number }[], now = new Date()) {
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  return paid - totalCharges(enrollments, now);
}
