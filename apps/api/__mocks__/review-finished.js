// eslint-disable-next-line @typescript-eslint/no-var-requires
const React = require('react');

const ReviewFinishedComponentMock = () =>
	React.createElement('div', null, 'Mocked ReviewFinishedComponent');

module.exports = ReviewFinishedComponentMock;
module.exports.REVIEW_COPY = new Proxy(
	{},
	{ get: () => ({ subject: 'Review', body: '' }) }
);
