const WAVE_GRAPHQL_ENDPOINT = "https://gql.waveapps.com/graphql/public";

export async function waveGraphQLRequest<T>(
  query: string,
  variables: Record<string, any> = {},
  customToken?: string
): Promise<T> {
  const token = customToken || process.env.WAVE_API_TOKEN;

  if (!token) {
    throw new Error(
      "Wave API token is missing. Please set WAVE_API_TOKEN in your environment or Settings."
    );
  }

  const response = await fetch(WAVE_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query,
      variables,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Wave API HTTP error (${response.status}): ${errorText}`);
  }

  const json = await response.json();

  if (json.errors && json.errors.length > 0) {
    const message = json.errors.map((e: any) => e.message).join(", ");
    throw new Error(`Wave GraphQL Error: ${message}`);
  }

  return json.data;
}

// Queries & Mutations
export const QUERIES = {
  GET_USER_BUSINESSES: `
    query GetBusinesses {
      businesses(page: 1, pageSize: 20) {
        edges {
          node {
            id
            name
            isPersonal
            currency {
              code
              symbol
            }
          }
        }
      }
      user {
        id
        defaultEmail
      }
    }
  `,

  GET_CUSTOMERS: `
    query GetCustomers($businessId: ID!) {
      business(id: $businessId) {
        id
        customers(page: 1, pageSize: 50) {
          edges {
            node {
              id
              name
              email
              currency {
                code
              }
            }
          }
        }
      }
    }
  `,

  GET_PRODUCTS: `
    query GetProducts($businessId: ID!) {
      business(id: $businessId) {
        id
        products(page: 1, pageSize: 50) {
          edges {
            node {
              id
              name
              unitPrice
              description
            }
          }
        }
      }
    }
  `,

  GET_INCOME_ACCOUNTS: `
    query GetIncomeAccounts($businessId: ID!) {
      business(id: $businessId) {
        id
        accounts(types: [INCOME], page: 1, pageSize: 20) {
          edges {
            node {
              id
              name
              type {
                name
                value
              }
            }
          }
        }
      }
    }
  `,

  CREATE_CUSTOMER: `
    mutation CustomerCreate($input: CustomerCreateInput!) {
      customerCreate(input: $input) {
        didSucceed
        inputErrors {
          code
          message
          path
        }
        customer {
          id
          name
          email
        }
      }
    }
  `,

  CREATE_PRODUCT: `
    mutation ProductCreate($input: ProductCreateInput!) {
      productCreate(input: $input) {
        didSucceed
        inputErrors {
          code
          message
          path
        }
        product {
          id
          name
          unitPrice
          description
        }
      }
    }
  `,

  CREATE_INVOICE: `
    mutation InvoiceCreate($input: InvoiceCreateInput!) {
      invoiceCreate(input: $input) {
        didSucceed
        inputErrors {
          code
          message
          path
        }
        invoice {
          id
          invoiceNumber
          status
          viewUrl
          pdfUrl
          total {
            raw
            value
          }
          customer {
            id
            name
            email
          }
        }
      }
    }
  `,

  APPROVE_INVOICE: `
    mutation InvoiceApprove($input: InvoiceApproveInput!) {
      invoiceApprove(input: $input) {
        didSucceed
        inputErrors {
          code
          message
          path
        }
        invoice {
          id
          status
        }
      }
    }
  `,

  SEND_INVOICE: `
    mutation InvoiceSend($input: InvoiceSendInput!) {
      invoiceSend(input: $input) {
        didSucceed
        inputErrors {
          code
          message
          path
        }
        invoice {
          id
          status
          viewUrl
        }
      }
    }
  `,
};
