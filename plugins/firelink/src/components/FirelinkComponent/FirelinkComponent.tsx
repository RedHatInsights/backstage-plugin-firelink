import React, { useEffect, useState } from 'react';
import { Typography, Paper, Tooltip, Button, Grid } from '@material-ui/core';
import { Header, Page, Content } from '@backstage/core-components';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Link from '@material-ui/core/Link';
import CheckCircleOutlineIcon from '@material-ui/icons/CheckCircleOutline';
import LinearProgress from '@material-ui/core/LinearProgress';

export const FirelinkComponent = () => {
  // Get Backstage objects
  const config = useApi(configApiRef);
  // Constants
  const backendUrl = config.getString('backend.baseUrl');
  const proxyUrl = `${backendUrl}/api/proxy/ephemeral`;

  const [namespaces, setNamespaces] = useState([]);
  const [namespaceReservations, setNamespaceReservations] = useState([]);
  const [namespacesLoading, setNamespacesLoading] = useState(true);
  const [namespaceReservationsLoading, setNamespaceReservationsLoading] =
    useState(true);
  const [error, setError] = useState(null);

  const TruncatedText = ({ text, max }) => {
    if (text.length <= max) {
      return <Typography>{text}</Typography>;
    }

    const truncatedText = text.slice(0, max) + '...';

    return (
      <Tooltip title={text}>
        <Typography style={{ cursor: 'pointer' }}>{truncatedText}</Typography>
      </Tooltip>
    );
  };

  function getEphemeralNamespaces() {
    setNamespacesLoading(true);
    const apiUrl = `${proxyUrl}/api/v1/namespaces`; // Replace with your Kubernetes API server URL
    fetch(apiUrl)
      .then(response => {
        if (!response.ok) {
          setNamespacesLoading(false);
          throw new Error(`Error fetching namespaces: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        // Filter namespaces prefixed with "ephemeral-"
        const ephemeralNamespaces = data.items.filter(
          namespace =>
            namespace.metadata.name.startsWith('ephemeral-') &&
            !namespace.metadata.name.includes('system'),
        );
        setNamespaces(ephemeralNamespaces);
        setNamespacesLoading(false);
      })
      .catch(error => {
        setError(
          new Error(`Error fetching namespaces: ${response.statusText}`),
        );
        console.error('Error:', error);
      });
  }

  function getNamespaceReservations() {
    setNamespaceReservationsLoading(true);
    const apiUrl = `${proxyUrl}/apis/cloud.redhat.com/v1alpha1/namespacereservations`;
    fetch(apiUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(
            `Error fetching NamespaceReservations: ${response.statusText}`,
          );
        }
        return response.json();
      })
      .then(data => {
        setNamespaceReservations(data);
        setNamespaceReservationsLoading(false);
      })
      .catch(error => {
        console.error('Error:', error);
        setError(
          new Error(
            `Error fetching NamespaceReservations: ${response.statusText}`,
          ),
        );
      });
  }

  useEffect(() => {
    getEphemeralNamespaces();
    getNamespaceReservations();
  }, []);

  if (error) {
    return <Typography variant="body1">Error: {error.message}</Typography>;
  }

  const getReservationForNamespace = namespace => {
    return namespaceReservations.items.find(
      reservation => reservation.status.namespace === namespace.metadata.name,
    );
  };

  function convertToLocalTime(isoDateString) {
    const date = new Date(isoDateString);
    return date.toLocaleString();
  }
  const NamespaceRow = ({ namespace }) => {
    if (namespace.status.phase === 'Terminating') {
      return null;
    }
    const reservation = getReservationForNamespace(namespace);
    const reserved = reservation ? true : false;
    return (
      <TableRow>
        <TableCell style={{ flex: 1 }}>
          <Link
            href={`https://firelink.apps.crc-eph.r9lp.p1.openshiftapps.com/namespace/describe/${namespace.metadata.name}`}
            target="_blank"
          >
            <Typography> {namespace.metadata.name}</Typography>
          </Link>
        </TableCell>
        <TableCell style={{ flex: 1 }}>
          {reserved ? (
            <CheckCircleOutlineIcon style={{ color: '#00FF11' }} />
          ) : (
            ''
          )}
        </TableCell>
        <TableCell style={{ flex: 1 }}><Typography> {namespace.status.phase}</Typography> </TableCell>
        <TableCell style={{ flex: 1 }}>
          {reserved ? (
            <TruncatedText text={reservation.spec.requester} max={20} />
          ) : (
            ''
          )}
        </TableCell>
        <TableCell style={{ flex: 1 }}>
          {<Typography> {namespace.metadata.labels.pool}</Typography> }
        </TableCell>
        <TableCell style={{ flex: 1 }}>
          {reserved ? convertToLocalTime(reservation.status.expiration) : ''}
        </TableCell>
      </TableRow>
    );
  };

  const refresh = () => {
    setNamespaceReservationsLoading(true);
    setNamespacesLoading(true);
    setError(null);
    getEphemeralNamespaces();
    getNamespaceReservations();
  };

  const reserveNamespace = () => {
    window.open(
      'https://firelink.apps.crc-eph.r9lp.p1.openshiftapps.com/namespace/reserve',
      '_blank',
    );
  };

  const NamespaceTable = () => {
    return (
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
            <TableCell style={{ flex: 1 }}>
              <Typography variant='button'>Namespace</Typography>
            </TableCell>
            <TableCell style={{ flex: 1 }}>
              <Typography variant='button'>Reserved</Typography>
            </TableCell>
            <TableCell style={{ flex: 1 }}>
              <Typography variant='button'>Status</Typography>
            </TableCell>
            <TableCell style={{ flex: 1 }}>
              <Typography variant='button'>Requester</Typography>
            </TableCell>
            <TableCell style={{ flex: 1 }}>
              <Typography variant='button'>Pool Type</Typography>
            </TableCell>
            <TableCell style={{ flex: 1 }}>
              <Typography variant='button'>Expiration</Typography>
            </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {namespaces.map(namespace => (
              <NamespaceRow
                key={namespace.metadata.name}
                namespace={namespace}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  return (
    <Page themeId="tool">
      <Header title="Ephemeral Namespaces">
        { namespacesLoading || namespaceReservationsLoading ? null : <Button onClick={refresh}>Refresh</Button> }
        <Button onClick={reserveNamespace}>Reserve</Button>
        <Button href="https://firelink.apps.crc-eph.r9lp.p1.openshiftapps.com/apps/deploy" target="_blank">Deploy</Button>
      </Header>
      <Content>
        { namespacesLoading || namespaceReservationsLoading ? <LinearProgress /> : <NamespaceTable /> }
      </Content>
    </Page>
  );
};
