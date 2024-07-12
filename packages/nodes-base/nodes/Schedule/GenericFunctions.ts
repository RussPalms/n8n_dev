import moment from 'moment-timezone';
import { type CronExpression, randomInt } from 'n8n-workflow';
import type { IRecurrenceRule, ScheduleInterval } from './SchedulerInterface';

export function recurrenceCheck(
	recurrence: IRecurrenceRule,
	recurrenceRules: number[],
	timezone: string,
): boolean {
	const recurrenceRuleIndex = recurrence.index;
	const intervalSize = recurrence.intervalSize;
	const typeInterval = recurrence.typeInterval;

	const lastExecution =
		recurrenceRuleIndex !== undefined ? recurrenceRules[recurrenceRuleIndex] : undefined;

	if (
		intervalSize &&
		recurrenceRuleIndex !== undefined &&
		(typeInterval === 'weeks' || typeInterval === 'undefined')
	) {
		if (
			lastExecution === undefined || // First time executing this rule
			moment.tz(timezone).week() === (intervalSize + lastExecution) % 52 || // not first time, but minimum interval has passed
			moment.tz(timezone).week() === lastExecution // Trigger on multiple days in the same week
		) {
			recurrenceRules[recurrenceRuleIndex] = moment.tz(timezone).week();
			return true;
		}
	} else if (intervalSize && recurrenceRuleIndex !== undefined && typeInterval === 'days') {
		if (
			lastExecution === undefined ||
			moment.tz(timezone).dayOfYear() === (intervalSize + lastExecution) % 365
		) {
			recurrenceRules[recurrenceRuleIndex] = moment.tz(timezone).dayOfYear();
			return true;
		}
	} else if (intervalSize && recurrenceRuleIndex !== undefined && typeInterval === 'hours') {
		if (
			lastExecution === undefined ||
			moment.tz(timezone).hour() === (intervalSize + lastExecution) % 24
		) {
			recurrenceRules[recurrenceRuleIndex] = moment.tz(timezone).hour();
			return true;
		}
	} else if (intervalSize && recurrenceRuleIndex !== undefined && typeInterval === 'months') {
		if (
			lastExecution === undefined ||
			moment.tz(timezone).month() === (intervalSize + lastExecution) % 12
		) {
			recurrenceRules[recurrenceRuleIndex] = moment.tz(timezone).month();
			return true;
		}
	} else {
		return true;
	}
	return false;
}

export const toCronExpression = (interval: ScheduleInterval): CronExpression => {
	if (interval.field === 'cronExpression') return interval.expression;
	if (interval.field === 'seconds') return `*/${interval.secondsInterval} * * * * *`;
	if (interval.field === 'minutes') return `* */${interval.minutesInterval} * * * *`;

	const randomMinute = interval.triggerAtMinute ?? randomInt(0, 60);
	if (interval.field === 'hours') return `* ${randomMinute} */${interval.hoursInterval} * * *`;

	const randomHour = interval.triggerAtHour ?? randomInt(0, 24);
	if (interval.field === 'days') return `* ${randomMinute} ${randomHour} * * *`;
	if (interval.field === 'weeks') {
		const days = interval.triggerAtDay;
		const daysOfWeek = days.length === 0 ? '*' : days.join(',');
		return `* ${randomMinute} ${randomHour} * * ${daysOfWeek}`;
	}

	const day = interval.triggerAtDayOfMonth ?? randomInt(0, 12);
	// interval.field === 'months'
	return `* ${randomMinute} ${randomHour} ${day} * *`;
};
