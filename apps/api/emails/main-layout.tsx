import React from 'react';
import {
	Html,
	Head,
	Container,
	Preview,
	Body,
	Section,
	Row,
	Column,
	Text,
	Img,
	Link,
	Button as EmailButton
} from '@react-email/components';
import { EmailBaseProps } from 'common/types';
import { color, font, FONTS_URL, layout, radius, text } from './theme';
import { LOGO_CID, LOGO_HEIGHT, LOGO_WIDTH } from './logo';

interface Props extends EmailBaseProps {
	children: React.ReactNode;
	/** The footer's last line: who it went to and why ("… about your submission."). */
	reason?: string;
}

/** The phone layout (Paper artboard "Sign-in link · 390"), for clients that read <style>. */
const RESPONSIVE = `
@media (max-width: 620px) {
	.q-body { padding: 32px 16px 40px !important; }
	.q-card { padding: 32px 24px 28px !important; }
	.q-tagline { display: none !important; }
	.q-heading { font-size: 26px !important; line-height: 32px !important; }
	.q-lede { font-size: 16px !important; line-height: 25px !important; }
	.q-button { display: block !important; text-align: center !important; }
}
`;

/** An address without its scheme, as the emails print it ("qotm.dev/q/8f2k1c"). */
export const bare = (site: string) =>
	site.replace(/^https?:\/\//, '').replace(/\/$/, '');

/**
 * Every qotm email: the logo and tagline over one white card on paper, then
 * a mono footer with the install command and why it was sent. Blocks inside
 * the card are spaced by the card itself (see `Stack`).
 */
const MainLayout = ({ children, subject, preview, site, reason }: Props) => {
	return (
		<Html lang="en">
			<Head>
				<title>{subject}</title>
				<meta name="color-scheme" content="light only" />
				<link rel="stylesheet" href={FONTS_URL} />
				<style>{RESPONSIVE}</style>
			</Head>
			{preview && <Preview>{preview}</Preview>}
			<Body
				style={{
					margin: 0,
					backgroundColor: color.paper,
					fontFamily: font.sans
				}}
			>
				<Container
					className="q-body"
					style={{
						width: '100%',
						maxWidth: `${layout.width}px`,
						padding: '48px 0 56px'
					}}
				>
					<Section style={{ padding: '0 4px 24px' }}>
						<Row>
							<Column>
								<Img
									src={`cid:${LOGO_CID}`}
									width={LOGO_WIDTH}
									height={LOGO_HEIGHT}
									alt="qotm"
									style={{
										display: 'block',
										...text.heading,
										fontSize: '20px'
									}}
								/>
							</Column>
							<Column align="right" className="q-tagline">
								<Text style={text.label}>a thought between commands</Text>
							</Column>
						</Row>
					</Section>
					<Section
						className="q-card"
						style={{
							backgroundColor: color.surface,
							border: `1px solid ${color.hairline}`,
							borderRadius: radius.card,
							padding: layout.cardPadding
						}}
					>
						<Stack>{children}</Stack>
					</Section>
					<Section style={{ padding: '32px 4px 0' }}>
						<Text style={{ ...text.meta, color: color.ink }}>
							~ &gt; npm i -g qotm
						</Text>
						<Text
							style={{
								...text.meta,
								fontSize: '12px',
								lineHeight: '19px',
								paddingTop: '8px'
							}}
						>
							{bare(site)}
							{reason ? ` · ${reason}` : ''}
						</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	);
};

/** The card's blocks, 28px apart (the design's gap; email clients have no `gap`). */
const Stack = ({
	children,
	gap = 28
}: {
	children: React.ReactNode;
	gap?: number;
}) => (
	<>
		{React.Children.toArray(children).map((child, i) => (
			<Section key={i} style={i ? { paddingTop: `${gap}px` } : undefined}>
				{child}
			</Section>
		))}
	</>
);

/** The mono label over the heading: what this email is ("✓ Verified · Review finished"). */
export const Eyebrow = ({ children }: { children: React.ReactNode }) => (
	<Text style={text.eyebrow}>{children}</Text>
);

/** The eyebrow, the headline (sentence case, a full stop) and the line under it. */
export const Heading = ({
	eyebrow,
	title,
	children
}: {
	eyebrow: React.ReactNode;
	title: string;
	children?: React.ReactNode;
}) => (
	<>
		<Eyebrow>{eyebrow}</Eyebrow>
		<Text className="q-heading" style={{ ...text.heading, paddingTop: '12px' }}>
			{title}
		</Text>
		{children ? (
			<Text className="q-lede" style={{ ...text.lede, paddingTop: '12px' }}>
				{children}
			</Text>
		) : null}
	</>
);

/** The email's one action: ink, or outline when a dark block sits above it. */
export const Button = ({
	href,
	children,
	variant = 'solid'
}: {
	href: string;
	children: React.ReactNode;
	variant?: 'solid' | 'outline';
}) => {
	const solid = variant === 'solid';
	return (
		<EmailButton
			href={href}
			pX={28}
			pY={14}
			className="q-button"
			target="_blank"
			style={{
				backgroundColor: solid ? color.ink : color.surface,
				color: solid ? color.paper : color.ink,
				border: `1px solid ${color.ink}`,
				borderRadius: radius.control,
				fontFamily: font.sans,
				fontSize: '15px',
				fontWeight: 500,
				lineHeight: '18px',
				textDecoration: 'none'
			}}
		>
			{children}
		</EmailButton>
	);
};

/** The button with a mono line under it ("Works once · expires in 10 minutes"). */
export const Action = ({
	children,
	caption
}: {
	children: React.ReactNode;
	caption?: React.ReactNode;
}) => (
	<>
		{children}
		{caption ? (
			<Text style={{ ...text.meta, paddingTop: '14px' }}>{caption}</Text>
		) : null}
	</>
);

/** The link spelled out, under a hairline, for when the button does not work. */
export const LinkFallback = ({ url }: { url: string }) => (
	<Section
		style={{ borderTop: `1px solid ${color.hairline}`, paddingTop: '24px' }}
	>
		<Text style={text.label}>Or paste this into your browser</Text>
		<Section
			style={{
				marginTop: '10px',
				backgroundColor: color.paper,
				border: `1px solid ${color.hairline}`,
				borderRadius: radius.field
			}}
		>
			<Text
				style={{
					...text.meta,
					color: color.ink,
					padding: '12px 14px',
					wordBreak: 'break-all'
				}}
			>
				<Link href={url} style={{ color: color.ink, textDecoration: 'none' }}>
					{url}
				</Link>
			</Text>
		</Section>
	</Section>
);

/** A quote as display type between two hairlines, its credit and id in mono. */
export const QuoteBlock = ({
	text: words,
	credit,
	id
}: {
	text: string;
	credit: string;
	id: string;
}) => (
	<Section
		style={{
			borderTop: `1px solid ${color.hairline}`,
			borderBottom: `1px solid ${color.hairline}`,
			padding: '26px 0'
		}}
	>
		<Text style={text.quote}>{`“${words}”`}</Text>
		<Row style={{ paddingTop: '14px' }}>
			<Column>
				<Text style={{ ...text.meta, color: color.ink }}>{credit}</Text>
			</Column>
			<Column align="right" style={{ width: '120px', verticalAlign: 'top' }}>
				<Text style={text.meta}>{id}</Text>
			</Column>
		</Row>
	</Section>
);

/** The clay wash: someone's words the reader has to act on (a reviewer's note). */
export const Note = ({
	label,
	children
}: {
	label: string;
	children: React.ReactNode;
}) => (
	<Section
		style={{
			backgroundColor: color.clay100,
			borderRadius: radius.field,
			padding: '18px 20px'
		}}
	>
		<Text style={{ ...text.label, color: color.clay700 }}>{label}</Text>
		<Text style={{ ...text.body, color: color.ink, paddingTop: '8px' }}>
			{children}
		</Text>
	</Section>
);

/** The dark field: a command to run, with an optional `#` comment under it. */
export const Terminal = ({
	command,
	comment
}: {
	command: string;
	comment?: string;
}) => (
	<Section
		style={{
			backgroundColor: color.ink,
			border: `1px solid ${color.inkRule}`,
			borderRadius: radius.terminal,
			padding: '20px 22px'
		}}
	>
		<Text
			style={{
				...text.meta,
				fontSize: '14px',
				lineHeight: '22px',
				color: color.paper
			}}
		>
			<span style={{ color: color.clay400 }}>~ &gt;</span>&nbsp;&nbsp;{command}
		</Text>
		{comment ? (
			<Text
				style={{
					...text.meta,
					fontSize: '14px',
					lineHeight: '22px',
					color: color.faint,
					paddingTop: '6px'
				}}
			>
				# {comment}
			</Text>
		) : null}
	</Section>
);

/** Quiet closing copy: why this arrived, what to do if it should not have. */
export const Fine = ({ children }: { children: React.ReactNode }) => (
	<Text style={text.body}>{children}</Text>
);

/* The password templates (on only in the test environment) use these. */

export const Salutation = ({ name }: { name?: string }) => (
	<Text style={text.body}>{name ? `Hi ${name},` : 'Hi,'}</Text>
);

export const OTP = ({ code }: { code: string }) => (
	<Text
		style={{
			...text.meta,
			fontSize: '20px',
			lineHeight: '28px',
			color: color.ink
		}}
	>
		{code}
	</Text>
);

export const CTAButton = ({
	text: label,
	url
}: {
	text: string;
	url: string;
}) => <Button href={url}>{label}</Button>;

export const CTAFallback = LinkFallback;

export default MainLayout;
