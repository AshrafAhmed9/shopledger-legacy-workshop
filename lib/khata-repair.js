'use strict';

function toPaise(amount) {
  if (typeof amount !== 'number' && typeof amount !== 'string') return null;
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(amount));
  if (!match) return null;
  const paise = Number(match[2]) * 100 + Number((match[3] || '').padEnd(2, '0'));
  if (!Number.isSafeInteger(paise)) return null;
  return match[1] ? -paise : paise;
}

function balanceFor(customer, settled) {
  const opening = toPaise(customer.openingBalance ?? 0);
  const billed = toPaise(customer.totalBilled ?? 0);
  const paid = toPaise(settled);
  if (opening === null || billed === null || paid === null) return null;
  const receivable = opening + billed;
  const balance = receivable - paid;
  return Number.isSafeInteger(receivable) && Number.isSafeInteger(balance) ? balance / 100 : null;
}

function needsReview(reason) {
  return { status: 'needs_review', proposedSettled: null, receiptIds: [], reason };
}

function preview(customer, receipts) {
  const savedBalance = balanceFor(customer, customer.totalSettled);
  if (typeof customer.totalSettled === 'number') {
    if (customer.totalSettled < 0 || savedBalance === null || savedBalance !== customer.balance) {
      return needsReview('The stored settled total and balance do not agree.');
    }
    return { status: 'clean', proposedSettled: null, receiptIds: [], reason: 'The stored amounts agree.' };
  }

  const checkpoint = customer.repairCheckpoint;
  if (!checkpoint) {
    return needsReview('A verified starting total and receipt list are required to choose a balance.');
  }
  if (typeof customer.totalSettled !== 'string' || savedBalance === null || savedBalance !== customer.balance) {
    return needsReview('The damaged value does not explain the balance in the saved account.');
  }
  const startingPaise = toPaise(checkpoint.settled);
  if (typeof checkpoint.settled !== 'number' || startingPaise === null || startingPaise < 0 ||
      !Number.isSafeInteger(checkpoint.afterReceiptId) || checkpoint.afterReceiptId < 0 ||
      !Array.isArray(checkpoint.receiptIds) || !checkpoint.receiptIds.length) {
    return needsReview('The starting total or receipt list is incomplete.');
  }

  const tail = receipts.filter(receipt => receipt.id > checkpoint.afterReceiptId)
    .sort((a, b) => a.id - b.id);
  if (tail.length !== checkpoint.receiptIds.length || tail.some((receipt, i) =>
    !Number.isSafeInteger(receipt.id) || receipt.customerId !== customer.id ||
    receipt.id !== checkpoint.receiptIds[i] || (i > 0 && receipt.id <= tail[i - 1].id))) {
    return needsReview('Receipts after the checkpoint do not match the verified receipt list.');
  }

  let prefix = customer.totalSettled;
  let proposedPaise = startingPaise;
  const receiptIds = [];
  for (const receipt of tail.reverse()) {
    const amount = toPaise(receipt.amount);
    const suffix = String(receipt.amount);
    if (typeof receipt.amount !== 'number' || amount === null || amount <= 0 || !prefix.endsWith(suffix)) {
      return needsReview('A recorded receipt cannot be matched exactly to the damaged value.');
    }
    prefix = prefix.slice(0, -suffix.length);
    proposedPaise += amount;
    receiptIds.push(receipt.id);
  }

  const proposedSettled = proposedPaise / 100;
  if (prefix !== String(checkpoint.settled) || !Number.isSafeInteger(proposedPaise) ||
      toPaise(proposedSettled) !== proposedPaise || balanceFor(customer, proposedSettled) === null) {
    return needsReview('The receipts do not reconstruct the verified starting total and a precise balance.');
  }
  return { status: 'repairable', proposedSettled, receiptIds, reason: 'The receipts match the verified starting total.' };
}

module.exports = { preview, balanceFor };
